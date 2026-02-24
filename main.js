const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const frameType = document.getElementById('frame-type');
const frameAnim = document.getElementById('frame-anim');
const frameColor = document.getElementById('frame-color');
const frameSpeedInput = document.getElementById('frame-speed');
const animType = document.getElementById('anim-type');
const imgSpeedInput = document.getElementById('img-speed');
const sizeInput = document.getElementById('size-multiplier');
const bgRemovalToggle = document.getElementById('bg-removal-toggle');
const canvasSizeSelect = document.getElementById('canvas-size');
const downloadGifBtn = document.getElementById('download-gif');
const downloadVideoBtn = document.getElementById('download-video');
const recordingOverlay = document.getElementById('recording-overlay');
const statusText = document.getElementById('status-text');
const dropZoneStatus = document.getElementById('drop-zone-status');
const templateSelect = document.getElementById('template-preset');
const loadingTextInput = document.getElementById('loading-text');
const textColorInput = document.getElementById('text-color');
const textPosSelect = document.getElementById('text-pos');

// Editor Elements
const editorCard = document.getElementById('editor-card');
const editorCanvas = document.getElementById('editor-canvas');
const editorCtx = editorCanvas.getContext('2d');
const editorContainer = document.getElementById('editor-container');
const brushEraser = document.getElementById('brush-eraser');
const brushRestore = document.getElementById('brush-restore');
const brushSizeInput = document.getElementById('brush-size');
const zoomLevelInput = document.getElementById('zoom-level');
const zoomValueDisplay = document.getElementById('zoom-value-display');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const brushCursor = document.getElementById('brush-cursor');
const brushUndo = document.getElementById('brush-undo');
const brushRedo = document.getElementById('brush-redo');
const brushCrop = document.getElementById('brush-crop');
const cropOverlay = document.getElementById('crop-overlay');
const cropRectEl = document.getElementById('crop-rect');
const cropActions = document.getElementById('crop-actions');
const cropConfirmBtn = document.getElementById('crop-confirm');
const cropCancelBtn = document.getElementById('crop-cancel');
const sourceCard = document.getElementById('source-card');
const sourceCanvas = document.getElementById('source-canvas');
const sourceCtx = sourceCanvas.getContext('2d');

let uploadedImage = null;
let originalImageCanvas = document.createElement('canvas');
let processedImageCanvas = document.createElement('canvas');
let animationId = null;
let imgTime = 0;
let frameTime = 0;
let currentTool = 'eraser';
let isDrawing = false;
let editorZoom = 1;
let historyStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

// Cropping State
let isCropping = false;
let cropStart = { x: 0, y: 0 };
let currentCrop = { x: 0, y: 0, w: 0, h: 0 };
let activeHandle = null;

function initCanvas() {
    const size = parseInt(canvasSizeSelect.value);
    canvas.width = size;
    canvas.height = size;
}

initCanvas();

// Templates
templateSelect.addEventListener('change', () => {
    const val = templateSelect.value;
    if (val === 'classic-spin') { frameType.value = 'ring'; frameAnim.value = 'spin'; animType.value = 'spin'; }
    else if (val === 'modern-dots') { frameType.value = 'dots'; frameAnim.value = 'spin'; animType.value = 'pulse'; }
    else if (val === 'energetic') { frameType.value = 'dual-ring'; frameAnim.value = 'spin'; animType.value = 'bounce'; }
    else if (val === 'playful-walk') { frameType.value = 'none'; animType.value = 'walk'; loadingTextInput.value = 'Walking...'; }
    else if (val === 'text-spinner') { frameType.value = 'none'; animType.value = 'none'; textPosSelect.value = 'circular'; loadingTextInput.value = 'NOW LOADING... '; }
});

// Prevent browser default behavior for drag and drop everywhere
['dragover', 'drop'].forEach(ev => {
    window.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

let lastDropTime = 0;

dropZone.addEventListener('click', (e) => {
    if (Date.now() - lastDropTime < 400) return;
    fileInput.click();
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

dropZone.addEventListener('dragover', () => {
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'rgba(99, 102, 241, 0.1)';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--glass)';
});

dropZone.addEventListener('drop', (e) => {
    lastDropTime = Date.now();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--glass)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

bgRemovalToggle.addEventListener('change', () => {
    if (uploadedImage) updateProcessedImage();
    syncEditorVisibility();
});

function syncEditorVisibility() {
    const active = !!uploadedImage && bgRemovalToggle.checked;
    editorCard.classList.toggle('hidden', !active);
    sourceCard.classList.toggle('hidden', !uploadedImage);
    if (active) renderEditor();
    if (uploadedImage) renderSource();
}

function handleFile(file) {
    if (!file) return;
    console.log("Processing file:", file.name, file.type, file.size);

    const reader = new FileReader();
    reader.onerror = (err) => console.error("FileReader error:", err);
    reader.onload = (e) => {
        const img = new Image();
        img.onerror = (err) => console.error("Image object loading error:", err);
        img.onload = () => {
            console.log("Image loaded:", img.width, "x", img.height);
            uploadedImage = img;

            setTimeout(() => {
                try {
                    originalImageCanvas.width = img.width;
                    originalImageCanvas.height = img.height;
                    originalImageCanvas.getContext('2d').drawImage(img, 0, 0);
                    processedImageCanvas.width = img.width;
                    processedImageCanvas.height = img.height;

                    updateProcessedImage();
                    startAnimation();
                    syncEditorVisibility();
                    renderSource();

                    dropZone.classList.add('collapsed');
                    dropZoneStatus.innerHTML = `
                        <i data-lucide="check-circle" style="color: #22c55e; width: 18px; height: 18px; vertical-align: middle; margin-right: 8px;"></i>
                        <span style="color: #22c55e; font-weight: 600; font-size: 0.9rem; vertical-align: middle;">反映済み</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 10px; vertical-align: middle;">(クリックで変更)</span>
                    `;
                    if (window.lucide) lucide.createIcons();

                    window.focus();
                    fileInput.blur();
                    fileInput.value = '';

                    // Reset Editor Zoom
                    editorZoom = 1;
                    updateEditorZoom();
                    console.log("Upload sequence successful.");
                } catch (err) {
                    console.error("Canvas processing error:", err);
                    alert("画像の処理中にエラーが発生しました。別の画像を試してください。");
                }
            }, 100);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateProcessedImage() {
    if (!uploadedImage) return;
    const pctx = processedImageCanvas.getContext('2d', { willReadFrequently: true });
    pctx.clearRect(0, 0, processedImageCanvas.width, processedImageCanvas.height);
    pctx.drawImage(originalImageCanvas, 0, 0);

    if (bgRemovalToggle.checked) {
        const threshold = 15;
        const imageData = pctx.getImageData(0, 0, processedImageCanvas.width, processedImageCanvas.height);
        const data = imageData.data;
        const targetR = data[0], targetG = data[1], targetB = data[2];
        for (let i = 0; i < data.length; i += 4) {
            const dist = Math.sqrt(Math.pow(data[i] - targetR, 2) + Math.pow(data[i + 1] - targetG, 2) + Math.pow(data[i + 2] - targetB, 2));
            if (dist < threshold * 2) data[i + 3] = 0;
        }
        pctx.putImageData(imageData, 0, 0);
    }
    renderEditor();
}

function renderEditor() {
    if (!uploadedImage || !bgRemovalToggle.checked) return;
    editorCanvas.width = processedImageCanvas.width;
    editorCanvas.height = processedImageCanvas.height;
    editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    editorCtx.drawImage(processedImageCanvas, 0, 0);
}

function renderSource() {
    if (!uploadedImage) return;
    sourceCanvas.width = uploadedImage.width;
    sourceCanvas.height = uploadedImage.height;
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.drawImage(uploadedImage, 0, 0);
}

// Editor Navigation Logic
function updateEditorZoom() {
    editorContainer.style.transform = `scale(${editorZoom})`;
    zoomValueDisplay.innerText = Math.round(editorZoom * 100);
    zoomLevelInput.value = editorZoom;
}

zoomLevelInput.addEventListener('input', () => { editorZoom = parseFloat(zoomLevelInput.value); updateEditorZoom(); });
zoomInBtn.addEventListener('click', () => { editorZoom = Math.min(4, editorZoom + 0.2); updateEditorZoom(); });
zoomOutBtn.addEventListener('click', () => { editorZoom = Math.max(0.5, editorZoom - 0.2); updateEditorZoom(); });

function saveHistory() {
    const pctx = processedImageCanvas.getContext('2d');
    historyStack.push(pctx.getImageData(0, 0, processedImageCanvas.width, processedImageCanvas.height));
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    redoStack = [];
}

function undo() {
    if (historyStack.length === 0) return;
    const pctx = processedImageCanvas.getContext('2d');
    redoStack.push(pctx.getImageData(0, 0, processedImageCanvas.width, processedImageCanvas.height));
    const previousState = historyStack.pop();
    pctx.putImageData(previousState, 0, 0);
    renderEditor();
}

function redo() {
    if (redoStack.length === 0) return;
    const pctx = processedImageCanvas.getContext('2d');
    historyStack.push(pctx.getImageData(0, 0, processedImageCanvas.width, processedImageCanvas.height));
    const nextState = redoStack.pop();
    pctx.putImageData(nextState, 0, 0);
    renderEditor();
}

// Manual Brush Logic ON THE EDITOR CANVAS
function handleManualRemoval(e) {
    if (!uploadedImage || !bgRemovalToggle.checked) return;
    const rect = editorCanvas.getBoundingClientRect();

    // Position relative to canvas element (already respects viewport scale via bounding rect)
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Map CSS pixels to Canvas internal pixels
    const x = (rawX / rect.width) * editorCanvas.width;
    const y = (rawY / rect.height) * editorCanvas.height;

    // Brush radius stays relative to source pixels
    const brushRadius = (parseInt(brushSizeInput.value) / 2) / editorZoom;

    const pctx = processedImageCanvas.getContext('2d');
    pctx.save();
    pctx.globalCompositeOperation = (currentTool === 'eraser') ? 'destination-out' : 'source-over';
    pctx.beginPath();
    pctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    if (currentTool === 'restore') {
        pctx.clip();
        pctx.drawImage(originalImageCanvas, 0, 0);
    } else {
        pctx.fill();
    }
    pctx.restore();
    renderEditor();
}

function updateCursor(e) {
    if (!bgRemovalToggle.checked || !uploadedImage) {
        brushCursor.style.display = 'none';
        return;
    }
    const rect = editorContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        brushCursor.style.display = 'block';
        brushCursor.style.left = (x / editorZoom) + 'px';
        brushCursor.style.top = (y / editorZoom) + 'px';

        // Visual brush size should match current zoomed scale
        const size = parseInt(brushSizeInput.value);
        brushCursor.style.width = (size / editorZoom) + 'px';
        brushCursor.style.height = (size / editorZoom) + 'px';
        editorContainer.style.cursor = 'none';
    } else {
        brushCursor.style.display = 'none';
        editorContainer.style.cursor = 'crosshair';
    }
}

editorCanvas.addEventListener('mousedown', (e) => {
    if (uploadedImage && bgRemovalToggle.checked) saveHistory();
    isDrawing = true;
    handleManualRemoval(e);
});

window.addEventListener('mousemove', (e) => {
    updateCursor(e);
    if (isDrawing && e.target === editorCanvas) { e.preventDefault(); handleManualRemoval(e); }
});

window.addEventListener('mouseup', () => { isDrawing = false; });

brushEraser.addEventListener('click', () => { currentTool = 'eraser'; brushEraser.classList.add('active'); brushRestore.classList.remove('active'); });
brushRestore.addEventListener('click', () => { currentTool = 'restore'; brushRestore.classList.add('active'); brushEraser.classList.remove('active'); });
brushUndo.addEventListener('click', undo);
brushRedo.addEventListener('click', redo);

// --- Cropping Logic ---
brushCrop.addEventListener('click', () => {
    isCropping = !isCropping;
    if (isCropping) {
        currentTool = 'crop';
        cropOverlay.classList.remove('hidden');
        cropActions.classList.remove('hidden');
        brushEraser.classList.remove('active');
        brushRestore.classList.remove('active');
        brushCrop.classList.add('active');

        // Default crop: 80% of current image
        currentCrop = {
            x: processedImageCanvas.width * 0.1,
            y: processedImageCanvas.height * 0.1,
            w: processedImageCanvas.width * 0.8,
            h: processedImageCanvas.height * 0.8
        };
        updateCropUI();
    } else {
        cancelCrop();
    }
});

function updateCropUI() {
    cropRectEl.style.left = currentCrop.x + 'px';
    cropRectEl.style.top = currentCrop.y + 'px';
    cropRectEl.style.width = currentCrop.w + 'px';
    cropRectEl.style.height = currentCrop.h + 'px';
}

function cancelCrop() {
    isCropping = false;
    cropOverlay.classList.add('hidden');
    cropActions.classList.add('hidden');
    brushCrop.classList.remove('active');
    currentTool = 'eraser';
    brushEraser.classList.add('active');
}

cropCancelBtn.addEventListener('click', cancelCrop);

cropConfirmBtn.addEventListener('click', () => {
    saveHistory(); // Allow undo of crop

    const cropX = currentCrop.x;
    const cropY = currentCrop.y;
    const cropW = currentCrop.w;
    const cropH = currentCrop.h;

    if (cropW < 5 || cropH < 5) return;

    // 1. Create temporary canvases to hold cropped contents
    const tempOriginal = document.createElement('canvas');
    tempOriginal.width = cropW;
    tempOriginal.height = cropH;
    tempOriginal.getContext('2d').drawImage(originalImageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const tempProcessed = document.createElement('canvas');
    tempProcessed.width = cropW;
    tempProcessed.height = cropH;
    tempProcessed.getContext('2d').drawImage(processedImageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // 2. Update main canvases
    originalImageCanvas.width = cropW;
    originalImageCanvas.height = cropH;
    originalImageCanvas.getContext('2d').drawImage(tempOriginal, 0, 0);

    processedImageCanvas.width = cropW;
    processedImageCanvas.height = cropH;
    processedImageCanvas.getContext('2d').drawImage(tempProcessed, 0, 0);

    cancelCrop();
    renderEditor();
});

// Event listeners for dragging crop handles and rectangle
cropOverlay.addEventListener('mousedown', (e) => {
    const rect = editorCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / editorCanvas.width);
    const y = (e.clientY - rect.top) / (rect.height / editorCanvas.height);

    // Check if clicking a handle
    const handle = e.target.closest('.crop-handle');
    if (handle) {
        activeHandle = handle.className.split(' ')[1];
        return;
    }

    // Check if clicking inside rect to move
    if (x >= currentCrop.x && x <= currentCrop.x + currentCrop.w && y >= currentCrop.y && y <= currentCrop.y + currentCrop.h) {
        activeHandle = 'move';
        cropStart = { x: x - currentCrop.x, y: y - currentCrop.y };
        return;
    }

    // Otherwise start new rect
    activeHandle = 'new';
    cropStart = { x, y };
    currentCrop = { x, y, w: 0, h: 0 };
});

window.addEventListener('mousemove', (e) => {
    if (!isCropping || !activeHandle) return;

    const rect = editorCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(editorCanvas.width, (e.clientX - rect.left) / (rect.width / editorCanvas.width)));
    const y = Math.max(0, Math.min(editorCanvas.height, (e.clientY - rect.top) / (rect.height / editorCanvas.height)));

    if (activeHandle === 'new') {
        currentCrop.x = Math.min(x, cropStart.x);
        currentCrop.y = Math.min(y, cropStart.y);
        currentCrop.w = Math.abs(x - cropStart.x);
        currentCrop.h = Math.abs(y - cropStart.y);
    } else if (activeHandle === 'move') {
        currentCrop.x = Math.max(0, Math.min(editorCanvas.width - currentCrop.w, x - cropStart.x));
        currentCrop.y = Math.max(0, Math.min(editorCanvas.height - currentCrop.h, y - cropStart.y));
    } else if (activeHandle === 'nw') {
        const dx = x - currentCrop.x;
        const dy = y - currentCrop.y;
        currentCrop.x = x;
        currentCrop.y = y;
        currentCrop.w -= dx;
        currentCrop.h -= dy;
    } else if (activeHandle === 'se') {
        currentCrop.w = x - currentCrop.x;
        currentCrop.h = y - currentCrop.y;
    } else if (activeHandle === 'ne') {
        currentCrop.w = x - currentCrop.x;
        const dy = y - currentCrop.y;
        currentCrop.y = y;
        currentCrop.h -= dy;
    } else if (activeHandle === 'sw') {
        const dx = x - currentCrop.x;
        currentCrop.x = x;
        currentCrop.w -= dx;
        currentCrop.h = y - currentCrop.y;
    }

    updateCropUI();
});

window.addEventListener('mouseup', () => { activeHandle = null; });

function startAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    function animate() {
        draw();
        imgTime += 0.01 * parseFloat(imgSpeedInput.value);
        frameTime += 0.01 * parseFloat(frameSpeedInput.value);
        animationId = requestAnimationFrame(animate);
    }
    animate();
}

function draw(overrideT = null) {
    const it = overrideT !== null ? overrideT : imgTime;
    const ft = overrideT !== null ? overrideT : frameTime;
    const size = canvas.width;
    const scale = parseInt(sizeInput.value) / 100;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    drawFrameMaterial(ctx, size, ft);

    if (uploadedImage) {
        ctx.save();
        ctx.translate(size / 2, size / 2);
        const baseSize = Math.min(size, size) * 0.45 * scale;
        const imgRatio = uploadedImage.width / uploadedImage.height;
        let dw = imgRatio > 1 ? baseSize : baseSize * imgRatio;
        let dh = imgRatio > 1 ? baseSize / imgRatio : baseSize;
        const type = animType.value;
        if (type === 'spin') ctx.rotate(it * Math.PI * 2);
        else if (type === 'bounce') ctx.translate(0, -Math.abs(Math.sin(it * Math.PI)) * (size * 0.1));
        else if (type === 'pulse') ctx.scale(1 + Math.sin(it * Math.PI * 2) * 0.15, 1 + Math.sin(it * Math.PI * 2) * 0.15);
        else if (type === 'float') { ctx.translate(0, Math.sin(it * Math.PI * 2) * (size * 0.05)); ctx.rotate(Math.sin(it * Math.PI) * 0.1); }
        else if (type === 'swing') ctx.rotate(Math.sin(it * Math.PI * 2) * 0.5);
        else if (type === 'walk') {
            const xPos = (size * 0.6) - (((it % 2) / 2) * size * 1.2);
            ctx.translate(xPos, -Math.abs(Math.sin(it * Math.PI * 4)) * (size * 0.03));
            ctx.rotate(Math.sin(it * Math.PI * 4) * 0.1);
        }
        ctx.drawImage(processedImageCanvas, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }

    const text = loadingTextInput.value;
    if (text) {
        ctx.save();
        ctx.font = `bold ${size * 0.07}px Inter, sans-serif`;
        ctx.fillStyle = textColorInput.value;
        ctx.textAlign = 'center';

        const pos = textPosSelect.value;
        if (pos === 'circular') {
            drawCircularText(ctx, size, text, ft);
        } else {
            let tx = size / 2, ty = pos === 'center' ? (size / 2 + size * 0.02) : (size * 0.92);
            ctx.fillText(text, tx, ty);
        }
        ctx.restore();
    }
    ctx.restore();
}

function drawCircularText(c, size, text, t) {
    const radius = size * 0.38;
    const characters = text.split('');
    const angleStep = (Math.PI * 2) / characters.length;

    c.save();
    c.translate(size / 2, size / 2);
    c.rotate(t * Math.PI * 2);

    characters.forEach((char, i) => {
        const angle = i * angleStep;
        c.save();
        c.rotate(angle);
        c.translate(0, -radius);
        c.fillText(char, 0, 0);
        c.restore();
    });
    c.restore();
}

function drawFrameMaterial(c, size, t) {
    const type = frameType.value; if (type === 'none') return;
    const radius = size * 0.35, anim = frameAnim.value;
    c.save(); c.translate(size / 2, size / 2); c.strokeStyle = frameColor.value; c.lineWidth = size * 0.03; c.lineCap = 'round';
    if (anim === 'spin') c.rotate(t * Math.PI * 2); else if (anim === 'spin-reverse') c.rotate(-t * Math.PI * 2); else if (anim === 'pulse') { const s = 1 + Math.sin(t * Math.PI * 2) * 0.1; c.scale(s, s); }
    if (type === 'ring') { c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 1.5); c.stroke(); }
    else if (type === 'dual-ring') {
        c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 0.5); c.stroke(); c.beginPath(); c.arc(0, 0, radius, Math.PI, Math.PI * 1.5); c.stroke();
        c.strokeStyle = '#f472b6'; if (anim !== 'static') c.rotate(-t * Math.PI * 4); c.beginPath(); c.arc(0, 0, radius * 0.8, 0, Math.PI * 0.5); c.stroke();
    } else if (type === 'dots') {
        const offset = (anim !== 'static') ? (t * Math.PI * 2) : 0;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + offset; c.fillStyle = frameColor.value; c.globalAlpha = i / 8;
            c.beginPath(); c.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, radius * 0.15, 0, Math.PI * 2); c.fill();
        }
    } else if (type === 'dash') {
        c.setLineDash([size * 0.05, size * 0.05]); if (anim !== 'static') c.lineDashOffset = -t * 100;
        c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
}

downloadGifBtn.addEventListener('click', () => {
    recordingOverlay.style.display = 'flex'; statusText.innerText = 'GIF生成中...';
    const frames = [], numFrames = 30, size = canvas.width;
    for (let i = 0; i < numFrames; i++) { draw(i * (2 / numFrames)); frames.push(canvas.toDataURL('image/png')); }
    gifshot.createGIF({ images: frames, gifWidth: size, gifHeight: size, interval: 0.05, numFrames: numFrames, transparent: '0x000000' }, (obj) => {
        if (!obj.error) { const link = document.createElement('a'); link.href = obj.image; link.download = `loading.gif`; link.click(); }
        recordingOverlay.style.display = 'none'; startAnimation();
    });
});

downloadVideoBtn.addEventListener('click', () => {
    recordingOverlay.style.display = 'flex'; statusText.innerText = '動画を録画中...';
    const avgSpeed = (parseFloat(imgSpeedInput.value) + parseFloat(frameSpeedInput.value)) / 2;
    const loopMs = (2 / (0.01 * (avgSpeed || 1))) * 16.6;
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 5000000 });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); link.download = `loading.webm`; link.click();
        recordingOverlay.style.display = 'none'; startAnimation();
    };
    imgTime = 0; frameTime = 0;
    recorder.start(); setTimeout(() => { recorder.stop(); }, Math.max(2000, loopMs));
});

canvasSizeSelect.addEventListener('change', () => { initCanvas(); if (uploadedImage) draw(); });
document.querySelectorAll('.bg-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.bg-toggle-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active'); document.getElementById('preview-window').className = 'preview-window ' + e.target.dataset.bg;
}));
document.getElementById('preview-window').classList.add('grid');
lucide.createIcons();
startAnimation();
