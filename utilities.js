const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
function compressFiles(files, format) {
    return new Promise((resolve, reject) => {
        const archive = archiver(format, {
            zlib: { level: 9 } // Sets the compression level.
        });
        const outputBuffers = [];

        archive.on('data', (data) => outputBuffers.push(data));
        archive.on('end', () => resolve(Buffer.concat(outputBuffers)));
        archive.on('error', (err) => reject(err));

        for (let file of files) {
            archive.append(file.buffer, { name: file.originalname });
        }

        archive.finalize();
    });
}

async function getUniqueFileName(desiredFileName) {
    let counter = 1;
    let fileNameParts = desiredFileName.split('.');
    let baseName = fileNameParts[0];
    let extension = fileNameParts[1];

    let currentFileName = desiredFileName;
    currentFileName = `${baseName}(${format(Date.now())}).${extension}`;
    return currentFileName;
}

function format(timestamp) {
    const date = new Date(timestamp);
    
    // Extract day, month, year, hours, minutes, and seconds
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');  // Months are 0-based
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Format as dd/mm/yyyy hh:mm:ss
    return `${day},${month},${year} ${hours}:${minutes}:${seconds}`;
}






module.exports = {
    compressFiles,
    getUniqueFileName,
}