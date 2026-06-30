// JSON 読み込み
import lyricConfig from "./data/mean.json";


console.log("selectedSong:", localStorage.getItem("selectedSong"));

let phrases = [];

// TextAlive Player
const audio = document.createElement("audio");
document.body.appendChild(audio);

const player = new TextAliveApp.Player({
  app: { token: "ClEUtPaEsCkG7QBF" },
  mediaElement: audio
});

function loadLyricConfig() {
  console.log("loaded config:", lyricConfig);
  return lyricConfig;
}

function chunkWords(words, maxLen = 8) {
  const chunks = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const w = words[i].text;
    const candidate = current + w;

    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      chunks.push(current);
      current = w;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
// 再生・停止
function startPlayback() {
  player.requestPlay();
  document.getElementById("overlay").style.display = "none";
  document.getElementById("pauseBtn").style.display = "block";
}

function stopPlayback() {
  player.requestPause();
  document.getElementById("overlay").style.display = "flex";
}

///////////////////////////////////////////////////////////////////////////////////////

// 曲読み込み
player.addListener({
  async onAppReady(app) {
    console.log("onAppReady fired");
    const songUrl = localStorage.getItem("selectedSong");
    await loadLyricConfig();   // ← JSON 読み込み
    player.createFromSongUrl(songUrl);
  },

  onVideoReady(v) {
    console.log("video ready");
    phrases = [];
    const allPhrases = v.phrases;
    console.log("allPhrases length:", allPhrases.length);
    console.log("allPhrases:", allPhrases);

    allPhrases.forEach((p, i) => {
      const cfg = lyricConfig.phrases[i] || {};
      //if (!p.words || p.words.length === 0) return;
      // const words = p.words;//TextAlive の単語を取得
      // const chunks = chunkWords(words);//ここで 8 文字以内でチャンク化

      //chunks.forEach((chunkText, idx) => {//チャンクごとに phrases に追加
        phrases.push({
          index: i,//ex)フレーズ0のチャンク1 → "0-1"
          text: p.text,
          start: p.startTime,   // 必要なら word.startTime に変更可
          end: p.endTime,
          lane: cfg.lane || "left",
          hitTime: cfg.hitTime || p.startTime,
          chorus: cfg.chorus || false
        });
      //});
    });

    console.log("chunked phrases:", phrases);
  },

  onTimeUpdate(position) {
    const current = phrases.find(p => p.start <= position && position < p.end);
    if (!current) return;

    if (current.lane === "left") {
      document.getElementById("lyrics-left").textContent = current.text;
      document.getElementById("lyrics-right").textContent = "";
    } else {
      document.getElementById("lyrics-right").textContent = current.text;
      document.getElementById("lyrics-left").textContent = "";
    }

    if (current.chorus) {
      // サビ演出
    }
  }
});

document.getElementById("overlay").onclick = startPlayback;
document.getElementById("playBtn").onclick = startPlayback;
document.getElementById("pauseBtn").onclick = stopPlayback;

// Three.js はそのまま

// ===== Three.js 部分（import 不要） =====

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 5);

const light = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(light);

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

