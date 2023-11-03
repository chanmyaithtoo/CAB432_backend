const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');  
const dotenv = require('dotenv');
dotenv.config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const app = express();
const { compressFiles, getUniqueFileName } = require("../SQS/utilities");
const { check, validationResult } = require("express-validator");
const SQS = new AWS.SQS();
const QUEUE_URL = process.env.SQS_QUEUE_URL; 



app.use(express.json());
app.use(cors());

const qutUsername = process.env.QUT_USER;


AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();


const routes = require('./routes')(S3);

app.use('/profile', routes);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user already exists
    const params = {
      TableName: "N11178931-users",
      Key: {
        "qut-username": qutUsername,
        username: username,
      },
    };

    let user = await dynamoDb.get(params).promise();

    if (user.Item) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password and save user to DynamoDB
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      TableName: "N11178931-users",
      Item: {
        "qut-username": qutUsername,
        username: username,
        password: hashedPassword,
      },
    };

    await dynamoDb.put(newUser).promise();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const params = {
      TableName: "N11178931-users",
      Key: {
        "qut-username": qutUsername,
        username: username,
      },
    };

    let user = await dynamoDb.get(params).promise();

    if (!user.Item || !(await bcrypt.compare(password, user.Item.password))) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { username: user.Item.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, username: user.Item.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

const uploadValidations = [
  check("username").notEmpty().withMessage("Username is required"),
  check("format")
    .isIn(["7z"])
    .withMessage("Invalid compression format"),
  // check("desiredFileName")
  //   .notEmpty()
  //   .withMessage("File name is required")
  //   .matches(/\.(zip|tar)$/)
  //   .withMessage("File name should end with .zip or .tar"),
];

// app.post(
//   "/upload",
//   upload.array("files"),
//   uploadValidations,

//   async (req, res) => {
    
//     // if (!errors.isEmpty()) {
//     //     return res.status(400).json({ errors: errors.array() });
//     // }
//     const errors = validationResult(req);

//     if (!errors.isEmpty()) {
//       console.log("Validation errors:", errors.array()); // Log the errors
//       return res.status(400).json({ errors: errors.array() });
//     }

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).send("No files uploaded.");
//     }

//     try {
//       const compressedBuffer = await compressFiles(req.files);
//       const dirName = `${req.body.username}_uploads`;
//       let desiredFileName = req.body.desiredFileName;
//       const uniqueFileName = await getUniqueFileName(desiredFileName);

//       const params = {
//         Bucket: process.env.AWS_BUCKET,
//         Key: `${dirName}/${uniqueFileName}`,
//         Body: compressedBuffer,
//       };

//       const uploadedData = await S3.upload(params).promise();

//       res.status(200).send("Successfully Compressed and Uploaded");
//     } catch (error) {
//       console.error("Error:", error);
//       res.status(500).send("Server error.");
//     }
//   }
// );

async function uploadToTemporaryS3(file, directory) {
  const filePath = directory + file.originalname;
  await S3.upload({
    Bucket: process.env.AWS_BUCKET,
    Key: filePath,
    Body: file.buffer
  }).promise();
  return filePath;
}

// app.post("/upload", upload.array("files"), uploadValidations, async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     console.log("Validation errors:", errors.array());
//     return res.status(400).json({ errors: errors.array() });
//   }

//   if (!req.files || req.files.length === 0) {
//     return res.status(400).send("No files uploaded.");
//   }

//   try {
//     const fileReferences = await Promise.all(req.files.map(uploadToTemporaryS3));

//     const sqsMessage = {
//       QueueUrl: QUEUE_URL,
//       MessageBody: JSON.stringify({
//         files: fileReferences,
//         username: req.body.username,
//         desiredFileName: req.body.desiredFileName
//       })
//     };

//     await SQS.sendMessage(sqsMessage).promise();
//     res.status(200).send("Files received. Compression will start shortly.");
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).send("Server error.");
//   }
// });


app.post("/upload", upload.array("files"), uploadValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation errors:", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }

  // Create a unique directory for each upload based on username and a UUID
  const uniqueDir = `TemporaryFiles/${req.body.username}_${uuidv4()}/`;

  try {
    // Modify the uploadToTemporaryS3 function to use the unique directory
    const fileReferences = await Promise.all(req.files.map(file => uploadToTemporaryS3(file, uniqueDir)));

    const sqsMessage = {
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        files: fileReferences,
        username: req.body.username,
        desiredFileName: req.body.desiredFileName
      })
    };

    await SQS.sendMessage(sqsMessage).promise();
    res.status(200).send("Files received. Compression will start shortly.");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error.");
  }
});





const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
