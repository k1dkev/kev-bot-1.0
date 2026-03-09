const { Message, VoiceChannel } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const { logAudioPlaySql } = require("../functions/logs/logAudioPlaySql.js");
const { audioDict, recentlyPlayedList } = require("../data");
const { PLAY_TYPE } = require("../enumerations/PlayType");
const { ensureFileDownloaded, cleanupAudioCache } = require("../functions/initialization/audio");

module.exports = {
  name: "p",
  description: "Play an audio file by name.",
  usage: "p!imback",
  //Note that there are two ways to call execute of p
  // p(message,args) or p(audio, voiceChannel, discordId)
  /**
   * @param {Object} methodargs
   * @param {Message} methodargs.message
   * @param {Array.<string>} methodargs.args
   * @param {string} methodargs.audio
   * @param {VoiceChannel} methodargs.voiceChannel
   * @param {string} methodargs.discordId
   * @param {number} methodargs.playType
   */
  execute({ message, args, audio, voiceChannel, discordId, playType }) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get discord id
        let _discordId = discordId || message?.author?.id;

        // Get playType Note playType = (0: p!, 1 : pr!, 2 : greeting!, 3 : raid!, 4 : farewell!)
        let _playType = playType || PLAY_TYPE.PLAY;

        // Getting file to play and checking that it exists
        var _audio = audio || args?.[0];
        if (!(_audio in audioDict)) return reject({ userMess: `"${_audio}" does not exist, ya dingus!` });

        // Get voice channel and verify voice channel is actually a voice channel
        var _voiceChannel = voiceChannel || message?.member?.voice?.channel;
        if (!_voiceChannel) return reject({ userMess: "You are not in a voice channel, ya dingus!" });

        // Ensure the file is downloaded before playing
        const localFilePath = await ensureFileDownloaded(_audio);

        // Join channel, play mp3 from the dictionary, leave when completed.
        const player = createAudioPlayer();
        const resource = createAudioResource(localFilePath);
        const connection = joinVoiceChannel({
          channelId: _voiceChannel.id,
          guildId: _voiceChannel.guild.id,
          adapterCreator: _voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false,
        });

        connection.subscribe(player);

        await entersState(connection, VoiceConnectionStatus.Ready, 30_000).catch((err) => {
          console.error(`Failed to enter ready state. Actual state: "${connection.state.status}". Error:`, err);
          connection.destroy();
          return reject({ userMess: "Voice connection failed to enter ready state." });
        });

        player.play(resource);
        player.on(AudioPlayerStatus.Idle, async () => {
          connection.destroy();
          await cleanupAudioCache();
        });

        // On every play update the recently played list
        recentlyPlayedList.pop();
        recentlyPlayedList.unshift({
          audio: _audio,
          datetime: new Date(Date.now()),
        });

        // On every play log the play, use playType to log what type of play it was
        try {
          await logAudioPlaySql(_discordId, _audio, _playType);
        } catch (err) {
          return reject({
            userMess: "SUPPRESS_GENERAL_ERR_MESSAGE",
            err: err,
          });
        }

        return resolve();
      } catch (err) {
        return reject({
          userMess: "Failed to play audio file. Please try again.",
          err: err,
        });
      }
    });
  },
};
