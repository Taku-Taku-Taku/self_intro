// 背景「インク水彩にじみ」演出（素のWebGL / 依存ライブラリなし）
// 試験的にページ全体（.page-bg：ビューポート固定）へ適用中。
// prefers-reduced-motion 指定時・WebGL非対応時は何もせず終了し、
// CSS側の静的グラデーション（.page-bg）がそのまま表示される。

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
uniform vec3 u_colBg;   /* ページ背景色（ヒーロー下端をここへ溶かす） */
uniform vec3 u_colBase; /* 余白の白 */
uniform vec3 u_colInk;  /* 藍（インディゴ） */

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

    float t = u_time * 0.06;

    /* 中スケールのノイズ＋ワープで、中くらいのにじみが画面に数個散らばるようにする */
    vec2 q = vec2(
        fbm(p * 1.1 + vec2(0.0, t)),
        fbm(p * 1.1 + vec2(3.7, 1.9 - t))
    );
    float f = fbm(p * 1.1 + 2.2 * q + vec2(t * 0.5, 0.0));

    /* しきい値はやや広めにとり、輪郭は残しつつ塊のべったり感を抑える */
    float ink = smoothstep(0.43, 0.66, f);

    /* 別のゆっくり流れるノイズで濃度を変調（濃くなったり薄くなったり） */
    float dens = fbm(p * 0.7 + vec2(7.3 - t * 0.8, 2.1 + t * 0.5));
    float strength = mix(0.28, 0.72, smoothstep(0.3, 0.7, dens));

    vec3 col = mix(u_colBase, u_colInk, ink * strength);

    /* 輪郭に沿って濃い縁を付ける（水彩のエッジだまり） */
    float edge = smoothstep(0.44, 0.52, f) - smoothstep(0.56, 0.7, f);
    col = mix(col, u_colInk, edge * 0.12);

    /* にじみの芯も少し濃くして深みを出す */
    col = mix(col, u_colInk, smoothstep(0.68, 0.92, f) * 0.16);

    /* 中央の本文カラム（縦帯）は薄くして可読性を確保
       （全画面固定なのでスクロール位置によらずテキスト背後が薄くなる） */
    float d = abs(uv.x - 0.5);
    col = mix(col, u_colBase, smoothstep(0.5, 0.12, d) * 0.4);

    gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function initInk() {
    const bg = document.querySelector('.page-bg');
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

    /* 藍一色：白い余白に藍の濃淡だけでにじませる */
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colBg'), hexToRgb('#f7f8f6'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colBase'), hexToRgb('#fbfcfb'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_colInk'), hexToRgb('#274b87'));
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');

    bg.appendChild(canvas);

    /* 輪郭が見える絵になったので描画解像度は表示の0.75倍（DPR上限は1.5のまま） */
    const RENDER_SCALE = 0.75;

    function resize() {
        /* DPRはモニタ間移動で変わるので毎回取得する */
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.max(1, Math.round(bg.clientWidth * dpr * RENDER_SCALE));
        const h = Math.max(1, Math.round(bg.clientHeight * dpr * RENDER_SCALE));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(uResolution, w, h);
        }
    }
    resize();
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(resize).observe(bg);
    } else {
        window.addEventListener('resize', resize);
    }

    const FRAME_MS = 1000 / 30; /* 30fps上限（モバイルの電池・発熱対策） */
    let simTime = 0; /* 描画していた時間だけを積算（停止からの復帰でジャンプさせない） */
    let prevNow = null;
    let last = 0;
    let rafId = 0;
    let ready = false;
    let inView = true;
    let visible = !document.hidden;
    let lost = false;

    function frame(now) {
        rafId = requestAnimationFrame(frame);
        if (now - last < FRAME_MS) return;
        last = now;
        if (prevNow !== null) {
            simTime += Math.min(now - prevNow, 100);
        }
        prevNow = now;
        gl.uniform1f(uTime, simTime / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!ready) {
            ready = true;
            canvas.classList.add('is-ready');
        }
    }

    function updateRunning() {
        const shouldRun = inView && visible && !lost;
        if (shouldRun && rafId === 0) {
            rafId = requestAnimationFrame(frame);
        } else if (!shouldRun && rafId !== 0) {
            cancelAnimationFrame(rafId);
            rafId = 0;
            prevNow = null;
        }
    }

    /* ヒーローが画面外・タブ非表示のときは描画を止める（非対応なら常時描画にフォールバック） */
    if (typeof IntersectionObserver !== 'undefined') {
        new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
            updateRunning();
        }).observe(bg);
    }
    document.addEventListener('visibilitychange', () => {
        visible = !document.hidden;
        updateRunning();
    });

    /* GPUリセット等でコンテキストが失われたら canvas を除去し、
       CSSの静的グラデーションにフォールバックする */
    canvas.addEventListener('webglcontextlost', () => {
        lost = true;
        updateRunning();
        canvas.remove();
    });

    rafId = requestAnimationFrame(frame);
}

initInk();
