// const { generateDependencyReport } = require("@discordjs/voice");
// console.log(generateDependencyReport());
// process.exit(0);

require("node:crypto").getCiphers().includes("aes-256-gcm");
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { Client, GatewayIntentBits, Events, Partials } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const PREFIX = "tp!";
const CLIPS_DIR = __dirname;

// const client = new Client({
//   intents: [
//     GatewayIntentBits.Guilds,
//     GatewayIntentBits.GuildMessages,
//     GatewayIntentBits.MessageContent,
//     GatewayIntentBits.GuildVoiceStates,
//   ],
// });

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once(Events.ClientReady, () => {
  console.log(`Ready as ${client.user.tag}`);
});

// client.on(Events.MessageCreate, async (message) => {
//   if (message.author.bot || !message.content.startsWith(PREFIX)) return;

//   const clipName = message.content.slice(PREFIX.length).trim().toLowerCase();
//   if (!clipName) return;

//   const filePath = path.join(CLIPS_DIR, `${clipName}.mp3`);
//   if (!fs.existsSync(filePath)) {
//     await message.reply(`Clip "${clipName}" not found. Put \`${clipName}.mp3\` in this folder.`);
//     return;
//   }

//   const voiceChannel = message.member?.voice?.channel;
//   if (!voiceChannel) {
//     await message.reply("You need to be in a voice channel.");
//     return;
//   }

//   const connection = joinVoiceChannel({
//     channelId: voiceChannel.id,
//     guildId: voiceChannel.guild.id,
//     adapterCreator: voiceChannel.guild.voiceAdapterCreator,
//     selfDeaf: false,
//     selfMute: false,
//   });

//   const player = createAudioPlayer();
//   const resource = createAudioResource(filePath);

//   player.on(AudioPlayerStatus.Idle, () => {
//     connection.destroy();
//   });
//   player.on("error", (err) => {
//     console.error("AudioPlayer error:", err);
//     connection.destroy();
//   });

//   connection.subscribe(player);
//   try {
//     await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
//     player.play(resource);
//     await message.reply(`Playing **${clipName}**`);
//   } catch (err) {
//     console.error("Voice connection failed:", err);
//     connection.destroy();
//     await message.reply("Failed to join voice or play. Try again.");
//   }
// });

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  if (!message.inGuild()) {
    await message.reply("This command only works in a server text channel.");
    return;
  }

  const clipName = message.content.slice(PREFIX.length).trim().toLowerCase();
  if (!clipName) return;

  if (!/^[a-z0-9_-]+$/.test(clipName)) {
    await message.reply("Invalid clip name.");
    return;
  }

  const filePath = path.join(CLIPS_DIR, `${clipName}.mp3`);
  if (!fs.existsSync(filePath)) {
    await message.reply(`Clip "${clipName}" not found.`);
    return;
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    await message.reply("You need to be in a voice channel.");
    return;
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(filePath);

  player.once(AudioPlayerStatus.Idle, () => connection.destroy());
  player.once("error", (err) => {
    console.error("AudioPlayer error:", err);
    connection.destroy();
  });

  connection.subscribe(player);

  connection.on("debug", (msg) => {
    console.log("[voice debug]", msg);
  });
  connection.on("stateChange", (oldState, newState) => {
    console.log(`Voice state: ${oldState.status} -> ${newState.status}`);
  });
  connection.on("error", console.error);
  player.on("error", console.error);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 60_000);
    player.play(resource);
    await message.reply(`Playing **${clipName}**`);
  } catch (err) {
    console.error("Voice connection failed:", err);
    console.error("Final connection state:", connection.state.status);
    connection.destroy();
    await message.reply("Failed to join voice or play. Try again.");
  }
});

client.login(process.env.BOT_TOKEN);
