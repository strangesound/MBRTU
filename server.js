const ModbusRTU = require("modbus-serial");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Разрешаем все источники
        methods: ["GET", "POST"]
    }
});

app.use(cors()); // Включаем CORS для всех маршрутов

const client = new ModbusRTU();

const SERIAL_PORT = "/dev/tty.usbserial-10"; // Замените на ваш порт
const MODBUS_ADDRESS = 16; // Адрес устройства Modbus
const REGISTER_ADDRESS = 0x0002; // Адрес первого регистра для чтения счётчика импульсов
const POLLING_INTERVAL = 200; // Интервал опроса в миллисекундах
const RECONNECT_INTERVAL = 5000; // Интервал попытки переподключения в миллисекундах

let previousValue = null; // Переменная для хранения предыдущего значения
let pollingIntervalId = null; // Идентификатор интервала опроса

// Функция для установки соединения
function connect() {
    client.connectRTU(SERIAL_PORT, { baudRate: 9600 }, function (err) {
        if (err) {
            console.error("Error connecting to serial port:", err);
            setTimeout(connect, RECONNECT_INTERVAL); // Попытка переподключения
            return;
        }
        console.log("Connected to serial port");

        // Устанавливаем адрес устройства
        client.setID(MODBUS_ADDRESS);
        startPolling(); // Запускаем опрос при успешном подключении
    });
}

// Функция для запуска периодического опроса
function startPolling() {
    pollingIntervalId = setInterval(() => {
        client.readInputRegisters(REGISTER_ADDRESS, 2, function (err, data) {
            if (err) {
                console.error("Error reading register:", err);
                clearInterval(pollingIntervalId); // Останавливаем опрос при ошибке
                client.close(() => {
                    setTimeout(connect, RECONNECT_INTERVAL); // Попытка переподключения
                });
                return;
            }

            // Преобразуем регистры 2 и 3 в 32-битное значение
            const high = data.data[0];
            const low = data.data[1];
            const currentValue = (high << 16) + low;

            // Проверяем, изменилось ли значение
            if (previousValue !== currentValue) {
                var date_time = new Date();
                console.log(date_time);

                console.log(`Value changed to: ${currentValue}`);
                previousValue = currentValue; // Обновляем предыдущее значение

                // Отправляем данные через WebSocket
                io.emit('modbus-data', currentValue);
            }
        });
    }, POLLING_INTERVAL);
}

// Запуск соединения
connect();

// Запуск сервера
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
