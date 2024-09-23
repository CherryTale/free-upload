// 创建按钮
const button = document.createElement('button');
button.innerText = '点击开始录屏';
button.style.padding = '10px 20px';
button.style.fontSize = '16px';
document.body.appendChild(button);

// 按钮点击事件
button.addEventListener('click', async () => {
    const r = [];
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) r.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(r, { type: 'video/webm' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'rec.webm';
            a.click();
        };

        mediaRecorder.start();
        alert('Recording... Click the button again to stop.');

        // 修改按钮点击事件为停止录制
        button.onclick = () => {
            mediaRecorder.stop();
            alert('Recording stopped.');
        };
    } catch (err) {
        console.error("Error accessing display media: ", err);
    }
});
