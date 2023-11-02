module.exports = {
  apps : [{
    name: "backend_server",
    script: "./server.js",
    watch: true,
    env: {
      "NODE_ENV": "development",
      "QUT_USER": "n11178931@qut.edu.au",
      "AWS_BUCKET": "n11178931-drive",
      "AWS_REGION": "ap-southeast-2",
      "JWT_SECRET": "Pr0fessi0nal",
      "SQS_QUEUE_URL": "https://sqs.ap-southeast-2.amazonaws.com/901444280953/N11178931_Queue"
    },
    env_production: {
      "NODE_ENV": "production",
      "QUT_USER": "n11178931@qut.edu.au",
      "AWS_BUCKET": "n11178931-drive",
      "AWS_REGION": "ap-southeast-2",
      "JWT_SECRET": "Pr0fessi0nal",
      "SQS_QUEUE_URL": "https://sqs.ap-southeast-2.amazonaws.com/901444280953/N11178931_Queue"

    }
  }]
}
