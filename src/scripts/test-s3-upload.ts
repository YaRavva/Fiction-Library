import { putObject } from "../lib/s3-service";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const testS3Upload = async () => {
  try {
    const filePath = path.join(__dirname, "test-file.txt");
    const fileContent = "Hello, S3 from TypeScript!";
    fs.writeFileSync(filePath, fileContent);

    const fileBuffer = fs.readFileSync(filePath);
    const key = `test-upload-${Date.now()}.txt`;

    await putObject(key, fileBuffer);
    console.log(`Object uploaded successfully with key: ${key}`);

    fs.unlinkSync(filePath); // Clean up the test file
  } catch (error) {
    console.error("Error uploading to S3:", error);
  }
};

testS3Upload();