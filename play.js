import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const fontUrl = new URL("./NotoSerifJP_SemiBold.font", import.meta.url).href;
// JSON 読み込み
import lyricConfig from "./data/mean.json";

console.log("selectedSong:", localStorage.getItem("selectedSong"));

let phrases = [];

// TextAlive Player
const audio = document.createElement("audio");
document.body.appendChild(audio);
let lastPhraseIndex = -1;

const player = new TextAliveApp.Player({
  app: { token: "ClEUtPaEsCkG7QBF" },
  mediaElement: audio
});
const vocabMergeList = [
  "一人",
  "心傷",
  "分かりきっ",
  "分かりきってる",
  "弱さ",
  "願ってる",
  "願ってるんだ",
  "いくんだね"

];

function loadLyricConfig() {
  console.log("loaded config:", lyricConfig);
  return lyricConfig;
}

function mergeWordsByPos(words) {
  const merged = [];
  let buffer = null;

  words.forEach(word => {
    const text = word.text;
    const pos = word.pos; // 品詞情報（TextAliveが提供）
    console.log("品詞:", word.pos);
    // ① 名詞（N/M）で辞書にある語なら結合
    if (buffer && vocabMergeList.includes(buffer.text + text)) {
      console.log("Listにありました");
      buffer.text += text;
      buffer.endTime = word.endTime;
    }
    // 助詞・助動詞なら前の語に結合
    else if (pos === "P" || pos === "X" || pos === "M") {
      if (buffer) {
        buffer.text += text;
        buffer.endTime = word.endTime; // タイミングも伸ばす
      } else {
        // 前に語がない場合は単独扱い
        buffer = { text, startTime: word.startTime, endTime: word.endTime };
      }
    } else {
      // 新しい語が来たら、前の語を確定
      if (buffer) merged.push(buffer);
      buffer = { text, startTime: word.startTime, endTime: word.endTime };
    }
  });

  if (buffer) merged.push(buffer);
  return merged;
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
    initThree();
    const songUrl = localStorage.getItem("selectedSong");
    //await loadLyricConfig();   // ← JSON 読み込み
    player.createFromSongUrl(songUrl);
  },

  onVideoReady(v) {
    console.log("video ready");
    phrases = [];
    const allPhrases = v.phrases;
    //console.log("allPhrases length:", allPhrases.length);
    console.log("allPhrases:", allPhrases);
    console.log(v.words[0].text);  // 最初の単語

    allPhrases.forEach((p, i) => {
      const cfg = lyricConfig.phrases[i] || {};
      //if (!p.words || p.words.length === 0) return;
      // const words = p.words;//TextAlive の単語を取得
      // const chunks = chunkWords(words);//ここで 8 文字以内でチャンク化

      //chunks.forEach((chunkText, idx) => {//チャンクごとに phrases に追加
        phrases.push({
          index: i,
          text: p.text,
          words: p.children,
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
    if (current.index === lastPhraseIndex) return;// フレーズが変わっていないなら何もしない
    lastPhraseIndex = current.index;

    const container = document.getElementById("lyrics");
    container.innerHTML = "";
    const fullText = current.text;
    const words = current.words; //単語配列
    /*[                    ↑
  { text: "あれ", startTime: 1000, endTime: 1500 },
  { text: "いつから", startTime: 1500, endTime: 2000 },
  { text: "ここ", startTime: 2000, endTime: 2300 },
  { text: "に", startTime: 2300, endTime: 2400 },
  { text: "いるんだっけ", startTime: 2400, endTime: 3000 }
]*/
    console.log(current.text);
    const mergedWords = mergeWordsByPos(words);
    console.log("まとめ:",mergedWords);
    mergedWords.forEach((word, i) => {//forEach で単語wordsを1つずつ取り出す
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = word.text;

      span.dataset.wordIndex = i;// Wordを紐づける data-word="単語"
  
      span.addEventListener("click", () => {// クリックイベント
        const w = mergedWords[span.dataset.wordIndex];
        console.log("クリックされた単語:", w.text);
      });
      container.appendChild(span);
    });
    
    // container.innerHTML = html;//タグの中を書き換える
    // document.getElementById("lyrics").textContent = current.text;
  }
});

document.getElementById("overlay").onclick = startPlayback;
document.getElementById("playBtn").onclick = startPlayback;
document.getElementById("pauseBtn").onclick = stopPlayback;

// ===== Three.js 部分　=====

let scene, camera, renderer;
let textMesh;
let loadedFont;

function initThree() {
  scene = new THREE.Scene();// 3D空間
  camera = new THREE.PerspectiveCamera(// カメラ
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 70;

  //<canvas> が body の最後に追加される
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // ライト
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  //scene.add(ambient);
  const light = new THREE.PointLight(0xffffff, 2);
  light.position.set(100, 100, 100);
  //scene.add(light);

  // フォント読み込み
  const loader = new FontLoader();
  loader.load(
    fontUrl,
    (font) => {
      console.log("Font loaded!");
      loadedFont = font;
      showText("あ");   // ← フォント読み込み後に表示
    },
    undefined,
    (err) => {
      console.error("Font load error:", err);
    }
  );

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
function showText(text) {
  if (!loadedFont) return;

  const shapes = loadedFont.generateShapes(text, 7); // size=7
  const geometry = new THREE.ShapeGeometry(shapes);

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  });

  textMesh = new THREE.Mesh(geometry, material);
  textMesh.position.set(0, 0, 0);
  scene.add(textMesh);

}



