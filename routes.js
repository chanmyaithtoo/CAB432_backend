const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { ProcessCredentials } = require("aws-sdk");
const router = express.Router();
dotenv.config();

router.use(bodyParser.json()); // Parse JSON request bodies
router.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded request bodies

module.exports = (S3) => {
  // Route to get a list of user's files
  router.get("/files", async (req, res) => {
    const { username } = req.query;

    const params = {
      Bucket: process.env.AWS_BUCKET,
      Prefix: `${username}_uploads/`,
    };

    S3.listObjects(params, (err, data) => {
      if (err) {
        console.error("Error retrieving files:", err);
        return res.status(500).json({ error: "Failed to retrieve files." });
      }

      const files = data.Contents.map((content) => content.Key);
      res.json(files);
    });
  });

  // Route to download a file
  router.get("/files/:filename", (req, res) => {
    const { username } = req.query;
    const filename = decodeURIComponent(req.params.filename).replace(
      `${username}_uploads/`,
      ""
    );
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: `${username}_uploads/${filename}`,
    };

    // Retrieve the file stream and send it as a response
    const fileStream = S3.getObject(params).createReadStream();
    fileStream.pipe(res);
  });

  // Route to delete a file
  router.delete("/files/:filename", (req, res) => {
    const { username } = req.query;
    const filename = decodeURIComponent(req.params.filename).replace(
      `${username}_uploads/`,
      ""
    );
    console.log(filename);
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: `${username}_uploads/${filename}`,
    };

    S3.deleteObject(params, (err, data) => {
      if (err) {
        console.error("Error deleting files", err);
        return res.status(500).json({ error: "Failed to delete file." });
      }
      res.json({ message: "File deleted successfully." });
    });
  });

  return router;
};
