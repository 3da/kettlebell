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

    console.log(relativeY);

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

