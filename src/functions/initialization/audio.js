const { sqlDatabase, audioBucket, audioPath, audioDict } = require("../../data");
const fs = require("fs-extra");
const path = require("path");

/**
 * Compare SQL audio table to files on the google bucket, they should match.
 */
async function compareSqlToGoogleBucket() {
  let results = await sqlDatabase.asyncQuery(`SELECT audio_name FROM audio;`);
  if (!results[0]) {
    throw "Audio could not be retrieved by the SQL server!";
  }
  const sqlAudioList = results.map((result) => result["audio_name"]);
  const [googleFiles] = await audioBucket.getFiles();
  const googleAudioList = googleFiles.map((file) => file.name.split(".")[0]);
  console.log(`There are ${googleAudioList.length} files on google cloud!`);

  // Compare SQL list to google list
  let sqlGoogleAudioComparePass = true;
  for (let sqlAudio of sqlAudioList) {
    if (!googleAudioList.includes(sqlAudio)) {
      console.log(`The google cloud audio list does not have the sql file "${sqlAudio}"`);
      sqlGoogleAudioComparePass = false;
    }
  }
  for (let googleAudio of googleAudioList) {
    if (!sqlAudioList.includes(googleAudio)) {
      console.log(`The sql audio list does not have the google file "${googleAudio}"`);
      sqlGoogleAudioComparePass = false;
    }
  }
  if (!sqlGoogleAudioComparePass) {
    throw "There is a mismatch between the google and sql audio files.";
  }
  return [googleFiles, googleAudioList];
}

/**
 * Store all of the file references in a dictionary without downloading
 * @param {Array} googleFiles - List of files from Google Cloud Storage
 */
async function initializeAudioDict(googleFiles) {
  for (const file of googleFiles) {
    const audio = file.name.split(".")[0];
    // Store the Google Cloud Storage file reference instead of local path
    audioDict[audio] = {
      localPath: path.join(audioPath, file.name),
      cloudFile: file,
      isDownloaded: false,
    };
  }
}

/**
 * Downloads a single file from Google Cloud Storage if not already downloaded
 * @param {string} audioName - The name of the audio file to download
 * @returns {Promise<string>} - The local path to the audio file
 */
async function ensureFileDownloaded(audioName) {
  console.log("ensureFileDownloaded called");
  if (!audioDict[audioName]) {
    throw new Error(`Audio file ${audioName} does not exist`);
  }

  const fileInfo = audioDict[audioName];

  // If already downloaded, return the local path
  if (fileInfo.isDownloaded && fs.existsSync(fileInfo.localPath)) {
    console.log("file already downloaded");
    return fileInfo.localPath;
  }

  // Create audio directory if it doesn't exist
  if (!fs.existsSync(audioPath)) {
    console.log("audio path does not exist, creating it");
    fs.mkdirSync(audioPath, { recursive: true });
  }

  // Download the file
  console.log("fileInfo.localPath", fileInfo.localPath);
  console.log("downloading file");
  await fileInfo.cloudFile.download({ destination: fileInfo.localPath });
  fileInfo.isDownloaded = true;
  console.log("download complete");

  return fileInfo.localPath;
}

/**
 * Check that the audioDict matches the google file list
 */
async function compareAudioDictToGoogleList(googleAudioList) {
  let dictGoogleAudioComparePass = true;
  for (let dictAudio of Object.keys(audioDict)) {
    if (!googleAudioList.includes(dictAudio)) {
      console.log(`The google audio list does not have the audioDict file "${dictAudio}"`);
      dictGoogleAudioComparePass = false;
    }
  }
  for (let googleAudio of googleAudioList) {
    if (!Object.keys(audioDict).includes(googleAudio)) {
      console.log(`The audioDict does not have the google file "${googleAudio}"`);
      dictGoogleAudioComparePass = false;
    }
  }
  if (!dictGoogleAudioComparePass) {
    throw "There is a mismatch between the google files and the audio dict.";
  }
}

/**
 * Initializes the audio system without downloading files
 * @param {Boolean} freshDownload - If true, clears the local audio cache
 */
async function audio(freshDownload = false) {
  try {
    console.log("Audio initializing...");
    const [googleFiles, googleAudioList] = await compareSqlToGoogleBucket();

    if (freshDownload) {
      fs.emptyDirSync(audioPath);
    }

    await initializeAudioDict(googleFiles);
    await compareAudioDictToGoogleList(googleAudioList);

    console.log("Audio initializing...done!");
  } catch (err) {
    console.error("Audio initializing...failed!");
    throw err;
  }
}

/**
 * Cleans up the local audio cache based on last access time
 * @param {number} maxCacheSize - Maximum number of files to keep in cache
 */
async function cleanupAudioCache(maxCacheSize = 100) {
  try {
    // Get all downloaded files
    const downloadedFiles = Object.entries(audioDict)
      .filter(([_, info]) => info.isDownloaded)
      .map(([name, info]) => ({
        name,
        path: info.localPath,
        lastAccessed: fs.statSync(info.localPath).atimeMs,
      }));

    // If we're under the limit, no need to clean up
    if (downloadedFiles.length <= maxCacheSize) {
      console.log("no files to cleanup, returning");
      return;
    }

    // Sort by last accessed time (oldest first)
    downloadedFiles.sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Remove oldest files until we're at the limit
    const filesToRemove = downloadedFiles.slice(0, downloadedFiles.length - maxCacheSize);

    for (const file of filesToRemove) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        audioDict[file.name].isDownloaded = false;
      }
    }
  } catch (err) {
    console.error("Failed to cleanup audio cache:", err);
  }
}

// Export the new function for use in other files
module.exports = {
  audio,
  ensureFileDownloaded,
  cleanupAudioCache,
};
