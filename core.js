// ============================================================
// ОТДЕЛЬНЫЙ JS МЕТОД ДЛЯ ОПРЕДЕЛЕНИЯ СОСТОЯНИЯ РУКИ
// ============================================================

/**
 * Определяет состояние руки на основе позиции запястья относительно плеча и угла в локте.
 * 
 * @param {Object} shoulder - точка плеча { x, y, visibility }
 * @param {Object} elbow - точка локтя { x, y, visibility }
 * @param {Object} wrist - точка запястья { x, y, visibility }
 * @param {number} minElbowAngle - минимальный допустимый угол в локте (градусы)
 * @returns {string} "UP" | "DOWN" | "ANGLE"
 */
function getArmState(shoulder, elbow, wrist, minElbowAngle) {

    // Проверяем видимость ключевых точек
    if (shoulder.visibility < 0.5 || wrist.visibility < 0.5 || elbow.visibility < 0.5) {
        return 'DOWN'; // По умолчанию считаем, что рука внизу
    }

    // Вычисляем относительную позицию запястья по Y
    const relativeY = wrist.y - shoulder.y;

    // Проверяем угол в локте
    const angle = calculateElbowAngle(shoulder, elbow, wrist);




    // Определяем положение руки по высоте
    if (relativeY < -0.1) {
        // Если угол меньше минимального — возвращаем ANGLE
        if (angle < minElbowAngle) {
            return 'ANGLE';
        }
        return 'UP';
    } else if (relativeY > 0.03) {
        return 'DOWN';
    } else {
        // Промежуточное положение — сохраняем предыдущее состояние
        return 'MIDDLE';
    }
}

/**
 * Вычисляет угол в локтевом суставе.
 */
function calculateElbowAngle(shoulder, elbow, wrist) {
    // Вектор от локтя к плечу
    const vectorA = {
        x: shoulder.x - elbow.x,
        y: shoulder.y - elbow.y
    };

    // Вектор от локтя к запястью
    const vectorB = {
        x: wrist.x - elbow.x,
        y: wrist.y - elbow.y
    };

    // Скалярное произведение
    const dotProduct = vectorA.x * vectorB.x + vectorA.y * vectorB.y;

    // Длины векторов
    const magnitudeA = Math.sqrt(vectorA.x * vectorA.x + vectorA.y * vectorA.y);
    const magnitudeB = Math.sqrt(vectorB.x * vectorB.x + vectorB.y * vectorB.y);

    // Косинус угла
    const cosAngle = dotProduct / (magnitudeA * magnitudeB);

    // Ограничиваем значение косинуса для избежания ошибок округления
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));

    // Вычисляем угол в радианах и переводим в градусы
    const angleRad = Math.acos(clampedCos);
    const angleDeg = angleRad * (180 / Math.PI);

    return angleDeg;
}

var state = {
}

function clearState() {
    state = {
        rightArmState: "DOWN",
        leftArmState: "DOWN",
        repetitions: 0,
    }
}

clearState();

function processPoseForReps(landmarks, minElbowAngle, handMode) {
    if (!landmarks || landmarks.length < 17) return;

    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];

    let newRightState = getArmState(
        rightShoulder,
        rightElbow,
        rightWrist,
        minElbowAngle
    );
    let newLeftState = getArmState(
        leftShoulder,
        leftElbow,
        leftWrist,
        minElbowAngle
    );

    if (newRightState === "MIDDLE") newRightState = state.rightArmState;
    if (newLeftState === "MIDDLE") newLeftState = state.leftArmState;

    let repCounted = false;

    if (handMode === "single") {
        if (state.rightArmState === "DOWN" && newRightState === "UP") {
            state.repetitions++;
            repCounted = true;
        }
        if (state.leftArmState === "DOWN" && newLeftState === "UP") {
            state.repetitions++;
            repCounted = true;
        }
        if (newRightState === "UP" || newRightState === "DOWN")
            state.rightArmState = newRightState;
        if (newLeftState === "UP" || newLeftState === "DOWN")
            state.leftArmState = newLeftState;
    } else {
        if (state.rightArmState === "DOWN" && state.leftArmState === "DOWN") {
            if (newRightState === "UP" && newLeftState === "UP") {
                state.repetitions++;
                repCounted = true;
                state.rightArmState = "UP";
                state.leftArmState = "UP";
            }
        } else if (state.rightArmState === "UP" && state.leftArmState === "UP") {
            if (newRightState === "DOWN" && newLeftState === "DOWN") {
                state.rightArmState = "DOWN";
                state.leftArmState = "DOWN";
            }
        }
    }

    if (repCounted)
        return true;

    if (state.leftArmState === 'ANGLE' || state.rightArmState === 'ANGLE')
        return 'ANGLE';

    return false;


}

function formatTime(totalSeconds) {
    // Обрабатываем отрицательное время
    const isNegative = totalSeconds < 0;
    const absoluteSeconds = Math.abs(totalSeconds);

    // Округляем до целых секунд
    const totalSecs = Math.round(absoluteSeconds);

    // Вычисляем минуты и секунды
    const minutes = Math.floor(totalSecs / 60);
    const seconds = totalSecs % 60;

    // Форматируем с ведущими нулями
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    // Собираем результат
    const timeString = `${formattedMinutes}:${formattedSeconds}`;

    return isNegative && absoluteSeconds > 0.5 ? `-${timeString}` : timeString;
}




// ---------- Камера ----------
async function getCameraStream() {
    const Camera = window.Camera;

    // Получаем список доступных камер
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
    );

    // Ищем широкоугольную фронтальную камеру
    let targetDeviceId = null;

    for (const device of videoDevices) {
        const capabilities = await getCameraCapabilities(device.deviceId);

        // Проверяем, является ли камера фронтальной и широкоугольной
        if (
            device.label.toLowerCase().includes("front") ||
            device.label.toLowerCase().includes("передняя")
        ) {
            // Проверяем характеристики широкоугольной камеры
            if (capabilities && capabilities.facingMode === "user") {
                // Широкоугольные камеры обычно имеют угол обзора > 80 градусов
                // или специальные метки в названии
                if (
                    device.label.toLowerCase().includes("wide") ||
                    device.label.toLowerCase().includes("ultra wide") ||
                    device.label.toLowerCase().includes("широкоугольная") ||
                    capabilities.viewAngle > 80 ||
                    // На некоторых устройствах широкоугольная камера имеет разрешение выше
                    (capabilities.width && capabilities.width.max >= 3840)
                ) {
                    targetDeviceId = device.deviceId;
                    break;
                }
            }
        }
    }

    // Если не нашли специфичную широкоугольную камеру,
    // используем первую фронтальную с наибольшим углом обзора
    if (!targetDeviceId) {
        let maxViewAngle = 0;

        for (const device of videoDevices) {
            const capabilities = await getCameraCapabilities(device.deviceId);

            if (capabilities && capabilities.facingMode === "user") {
                if (capabilities.viewAngle > maxViewAngle) {
                    maxViewAngle = capabilities.viewAngle;
                    targetDeviceId = device.deviceId;
                }
            }
        }
    }


    if (targetDeviceId) {
        return await navigator.mediaDevices.getUserMedia({
            video: {
                targetDeviceId
            },
            audio: false,
        });
    }



    return await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 1.777 },
        },
        audio: false,
    });

}

// Вспомогательная функция для получения характеристик камеры
async function getCameraCapabilities(deviceId) {
    try {
        // Создаем временный stream для проверки capabilities
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: { exact: deviceId },
                width: { ideal: 4096 }, // Запрашиваем максимальное разрешение
                height: { ideal: 2160 },
            },
        });

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities
            ? track.getCapabilities()
            : null;

        // Останавливаем временный поток
        track.stop();

        // Дополнительная информация из метаданных
        const settings = track.getSettings ? track.getSettings() : null;

        return {
            ...capabilities,
            width: capabilities?.width,
            height: capabilities?.height,
            facingMode: track.getSettings?.()?.facingMode || "unknown",
            viewAngle: calculateViewAngle(settings?.width, settings?.height),
        };
    } catch (error) {
        console.warn(
            "Не удалось получить capabilities для камеры:",
            deviceId,
            error
        );
        return null;
    }
}

// Функция для расчета угла обзора на основе разрешения
function calculateViewAngle(width, height) {
    // Примерный расчет угла обзора на основе разрешения
    // Широкоугольные камеры обычно имеют соотношение сторон 16:9 или шире
    if (!width || !height) return 0;

    const aspectRatio = width / height;

    // Эвристика: чем шире соотношение, тем больше угол обзора
    if (aspectRatio >= 2.0) return 120; // Сверхширокоугольная
    if (aspectRatio >= 1.77) return 90; // Широкоугольная (16:9)
    if (aspectRatio >= 1.6) return 75; // Стандартная широкая
    return 60; // Стандартная
}

// Альтернативный метод: прямой доступ через MediaStream API (более надежный)
async function startCameraAlternative() {
    if (cameraInstance) return;
    if (!pose) await initPose();

    try {
        // Получаем доступ к камере через MediaStream API
        const constraints = {
            video: {
                facingMode: "user",
                width: { min: 1920, ideal: 3840, max: 4096 },
                height: { min: 1080, ideal: 2160, max: 2160 },
                aspectRatio: { ideal: 16 / 9 },
            },
        };

        // Пытаемся получить доступ с высоким разрешением (широкоугольные камеры)
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            // Если не получилось, пробуем с меньшими требованиями
            constraints.video.width = { ideal: 1920 };
            constraints.video.height = { ideal: 1080 };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        }

        videoElement.srcObject = stream;
        await videoElement.play();

        console.log("Камера запущена:", {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            aspectRatio: videoElement.videoWidth / videoElement.videoHeight,
        });

        // Если библиотека Camera поддерживает stream
        const Camera = window.Camera;
        cameraInstance = new Camera(videoElement, {
            onFrame: async () => {
                if (pose && videoElement.readyState >= 2) {
                    await pose.send({ image: videoElement });
                }
            },
            frameRate: 24,
        });

        await cameraInstance.start();

        setTimeout(() => {
            if (videoElement.videoWidth && videoElement.videoHeight) {
                adjustVideoWrapperSize();
            }
        }, 800);
    } catch (err) {
        console.error("Ошибка камеры:", err);
        alert("Не удалось получить доступ к камере.");
        throw err;
    }
}


