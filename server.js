const express = require("express");
const cors = require("cors");
const fs = require("fs");
const mm = require("music-metadata");
const Throttle = require("throttle");
const { PassThrough } = require("stream");

const app = express();
const port = 3000;

app.use(express.static("static"));
app.use(cors());

const trackFolder = "./static/tracks";
const tracks = fs
  .readdirSync(trackFolder)
  .filter((filename) => !filename.startsWith("."));
let currentTrack = 0;

const listeners = new Map();

app.get("/", (req, res) => {
  const { id, stream } = createListener();
  res.type("audio/mpeg");
  res.status(206);
  stream.pipe(res);
});

const play = async () => {
  try {
    const filePath = `${trackFolder}/${tracks[currentTrack]}`;
    const songReadable = fs.createReadStream(filePath);
    const fileData = await mm.parseFile(filePath);
    const bitRate = fileData.format.bitrate / 8;
    const throttleTransformable = new Throttle(bitRate);
    songReadable.pipe(throttleTransformable);
    throttleTransformable.on("data", (chunk) => {
      broadcast(chunk);
    });
    throttleTransformable.on("error", (e) => console.log(e));
    throttleTransformable.on("end", () => {
      currentTrack = Math.floor(Math.random() * tracks.length);
      play();
    });
  } catch (err) {
    console.log(err);
    currentTrack = Math.floor(Math.random() * tracks.length);
    setTimeout(() => {
      play();
    }, 2000);
  }
};

const broadcast = (chunk) => {
  for (let [id, stream] of listeners) {
    stream.write(chunk);
  }
};

const createListener = () => {
  const id = Math.random().toString(36).slice(2);
  const stream = new PassThrough();
  listeners.set(id, stream);
  return { id, stream };
};

app.listen(port, () => {
  console.log(`Listening on ${port}, m'lord!`);
  play();
});
