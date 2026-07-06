// ヒーロー背景「インク水彩にじみ」演出（素のWebGL / 依存ライブラリなし）
// prefers-reduced-motion 指定時・WebGL非対応時は何もせず終了し、
// CSS側の静的グラデーション（.hero-bg）がそのまま表示される。

const VERT_SRC = `
attribute vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colBg;    /* ページ背景色（ヒーロー下端をここへ溶かす） */
uniform vec3 u_colBase;  /* にじみのベース色 */
uniform vec3 u_colTeal;  /* 青緑 */
uniform vec3 u_colGreen; /* 緑 */
uniform vec3 u_colBlue;  /* 青紫 */

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(31.4, 17.2);
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = uv;
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.03;

    /* 2段のドメインワープでインクの筋を作る */
    vec2 q = vec2(
        fbm(p * 1.4 + vec2(0.0, t)),
        fbm(p * 1.4 + vec2(5.2, t * 1.3 + 1.3))
    );
    vec2 r = vec2(
        fbm(p * 1.4 + 4.0 * q + vec2(1.7, 9.2 - t)),
        fbm(p * 1.4 + 4.0 * q + vec2(8.3, 2.8 + t))
    );
    float f = fbm(p * 1.4 + 4.0 * r);

    vec3 col = u_colBase;
    col = mix(col, u_colTeal, smoothstep(0.25, 0.8, f));
    col = mix(col, u_colGreen, smoothstep(0.3, 0.9, q.y) * 0.55);
    col = mix(col, u_colBlue, smoothstep(0.4, 0.95, r.x) * 0.45);

    /* 淡い水彩トーンに引き戻す */
    col = mix(u_colBase, col, 0.5);

    /* 中央（文字の背後）はさらに薄くして可読性を確保 */
    float d = distance(uv, vec2(0.5, 0.5));
    col = mix(col, u_colBase, smoothstep(0.55, 0.05, d) * 0.4);

    /* 下端はページ背景色へ溶かし、本文との境界を消す */
    col = mix(u_colBg, col, smoothstep(0.0, 0.22, uv.y));

    gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function initInk() {
    const bg = document.querySelector('.hero-bg');
    if (!bg) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        powerPreference: 'low-power',
    });
    if (!gl) return;

    function compile(type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
        return shader;
    }

    const vert = compile(gl.VERTEX_SHADER, VERT_SRC);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    /* フルスクリーン三角形 */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* 睡蓮パレット（style.css のデザイントークンと対応） */
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colBg'), hexToRgb('#f7f8f6'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colBase'), hexToRgb('#eef4f3'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colTeal'), hexToRgb('#1a5f7a'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colGreen'), hexToRgb('#608d7a'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colBlue'), hexToRgb('#4a689e'));
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');

    bg.appendChild(canvas);

    /* にじみ絵なので低解像度で十分。DPRは1.5、描画は表示サイズの0.5倍に抑える */
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const RENDER_SCALE = 0.5;

    function resize() {
        const w = Math.max(1, Math.round(bg.clientWidth * DPR * RENDER_SCALE));
        const h = Math.max(1, Math.round(bg.clientHeight * DPR * RENDER_SCALE));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(uResolution, w, h);
        }
    }
    resize();
    new ResizeObserver(resize).observe(bg);

    const FRAME_MS = 1000 / 30; /* 30fps上限（モバイルの電池・発熱対策） */
    const start = performance.now();
    let last = 0;
    let rafId = 0;
    let ready = false;
    let inView = true;
    let visible = !document.hidden;

    function frame(now) {
        rafId = requestAnimationFrame(frame);
        if (now - last < FRAME_MS) return;
        last = now;
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!ready) {
            ready = true;
            canvas.classList.add('is-ready');
        }
    }

    function updateRunning() {
        const shouldRun = inView && visible;
        if (shouldRun && rafId === 0) {
            rafId = requestAnimationFrame(frame);
        } else if (!shouldRun && rafId !== 0) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
    }

    /* ヒーローが画面外・タブ非表示のときは描画を止める */
    new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        updateRunning();
    }).observe(bg);
    document.addEventListener('visibilitychange', () => {
        visible = !document.hidden;
        updateRunning();
    });

    rafId = requestAnimationFrame(frame);
}

initInk();
