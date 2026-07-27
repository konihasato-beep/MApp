import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const fontUrl = new URL("./NotoSerifJP_SemiBold.font", import.meta.url).href;
// JSON 読み込み
import lyricConfig from "./data/mean.json";
import effectConfig from "./data/effect.json";

console.log("selectedSong:", localStorage.getItem("selectedSong"));

let phrases = [];
let lyricMeshes = [];
let needReset3D = false;
let start_next = 0;
//const count = 0;

// TextAlive Player
const audio = document.createElement("audio");
document.body.appendChild(audio);
const lyricMeshByIndex = Array(18).fill(null);
let lastPhraseIndex = -1;

const player = new TextAliveApp.Player({
  app: { token: "" },
  mediaElement: audio
});

function getEffectCount(index) {
  const item = effectConfig.phrases.find(p => p.index === index);
  
  return item ? item.count : 0;
  
}
function loadLyricConfig() {
  console.log("loaded config:", lyricConfig);
  return lyricConfig;
}
const vocabMergeList = [
  "一人",
  "心傷",
  "与えられ",
  "与えられた",
  "分かりきっ",
  "分かりきってる",
  "弱さ",
  "願ってる",
  "願ってるんだ",
  "いくんだね",
  "縋って",
  "縋ってい",
  "縋っていた"
  
];
const mergeExceptionList = [
  "不甲斐ないなんて",
  "縋っていただけ"
];
function mergeWordsByPos(words) {
  const merged = [];
  let buffer = null;

  words.forEach(word => {
    const text = word.text;
    const pos = word.pos; // 品詞情報（TextAliveが提供）
    console.log("品詞:", word.pos);
    // ① 名詞（N/M）で辞書にある語なら結合
    if (buffer && vocabMergeList.includes(buffer.text + text)) {
      console.log("Listにありました",buffer.text + text);
      buffer.text += text;
      buffer.endTime = word.endTime;
    }
    // 助詞・助動詞なら前の語に結合
    else if (pos === "P" || pos === "X" || pos === "M" ) { //&& !mergeExceptionList.includes(buffer.text += text)
      if(mergeExceptionList.includes(buffer.text + text)){
        if (buffer) merged.push(buffer);
        buffer = { text, startTime: word.startTime, endTime: word.endTime };
        return;
      }
      else if (buffer) {
        buffer.text += text;
        buffer.endTime = word.endTime; // タイミングも伸ばす
      } 
      else {
        // 前に語がない場合は単独扱い
        buffer = { text, startTime: word.startTime, endTime: word.endTime };
      }
    } 
    else {
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
    show3DText("気が付いても気が付いてもどうでもいい",0);
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
  
    if (current.index !== lastPhraseIndex) {
      needReset3D = true;
      requestAnimationFrame(() => {
        lyricMeshes.forEach(m => scene.remove(m));
        lyricMeshes = [];
      });
      lastPhraseIndex = current.index;
    }

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
    console.log(current.index);
    const count = getEffectCount(current.index);
    console.log("演出対象の数:", count);
    const mergedWords = mergeWordsByPos(words);
    console.log("まとめ:",mergedWords);
    mergedWords.forEach((word, i) => {//forEach で単語wordsを1つずつ取り出す
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = word.text; 
      start_next = 0;

      span.dataset.wordIndex = i;// Wordを紐づける data-word="単語"
  
      span.addEventListener("click", () => {// クリックイベント
        const w = mergedWords[span.dataset.wordIndex];
        console.log("クリックされた単語:", w.text);
       
        show3DText(w.text,count);
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

//                                                     Three.js 部分　

let scene, camera, renderer;
let textMesh;
let loadedFont;

function initThree() {
  scene = new THREE.Scene();// 3D空間
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 90);
  camera.lookAt(0, 0, 0);

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
      //showText("あいうえお");   // ← フォント読み込み後に表示
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
  // if (needReset3D) {
  //   lyricMeshes.forEach(m => scene.remove(m));
  //   lyricMeshes = [];
  //   needReset3D = false;
  // }
  renderer.render(scene, camera);
}
const lyricPositions = [//必要な分追加
  { x: -65, y: 30, z: 30 ,rotation_y: 0.6},//0
  { x: -85, y: 28, z: -15 ,rotation_y: -0.3},//1
  { x: -80, y: 5, z: 5 ,rotation_y: 0.3},//2
  { x: -40, y: -10, z: 35 ,rotation_y: -0.4},//3
  { x: -80, y: -25, z: 15 ,rotation_y: 0.4},//4
  { x: -90, y: -50, z: -15 ,rotation_y: -0.2}, //5

  { x: 32, y: 20, z: 40 ,rotation_y: 0.4},//6
  { x: 67, y: 13, z: 10 ,rotation_y: -0.3},//7
  { x: 65, y: -5, z: 5 , rotation_y: 0.3},//8
  { x: 50, y: -10, z: 35 ,rotation_y: -0.5},//9
  { x: 50, y: -25, z: 20 ,rotation_y: 0.4},//10
  { x: 90, y: -55, z: -17 ,rotation_y: -0.2},//11

  { x: -15, y: 30, z: 30 ,rotation_y: 0.6},//12
  { x: 5, y: 25, z: -15 ,rotation_y: -0.3},//13
  { x: -33, y: 10, z: 5 ,rotation_y: 0.3},//14
  { x: 10, y: -6, z: 35 ,rotation_y: -0.5},//15
  { x: -17, y: -28, z: 15 ,rotation_y: 0.4},//16
  { x: 5, y: -50, z: -15 ,rotation_y: -0.2} //17
];
function show3DText(text, cnt) {
  if (!loadedFont) return;

  const chars = [...text]; //文字列を1文字ずつの配列に変換
  const len = chars.length;//文字数(長さ)

  //const start = Math.floor((6 - len) / 2);// 中央寄せの開始位置
  let start = 0;
  start = start_next;
  if(cnt === 1){
    start = 12;
  }
  start_next = start;
  // if (len === 1){
  //   start = 0;
  // }
  
  chars.forEach((char, i) => {
    const size = 7;
    const shapes = loadedFont.generateShapes(char, size);// size=7
    const geometry = new THREE.ShapeGeometry(shapes);

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    //index はここで自動で Number（整数）
    const index = start + i;
    const pos = lyricPositions[index];//指定した位置

    const oldMesh = lyricMeshByIndex[index];
    if (oldMesh) {
      scene.remove(oldMesh);
    }
    mesh.position.set(pos.x, pos.y, pos.z+5);
    mesh.rotation.y = pos.rotation_y;

    // クリックできるよう保存
    mesh.userData.index = index;
    mesh.userData.char = char;

    lyricMeshes.push(mesh);
    lyricMeshByIndex[index] = mesh;
    scene.add(mesh);
  });
  start_next = start_next + 6;
  if (start_next > 17)start_next = start_next - 18;
}



