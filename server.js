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

let previousValue = null; // Переменная для хранения предыдущего значения

// Открываем соединение по серийному порту с заданной скоростью
client.connectRTU(SERIAL_PORT, { baudRate: 9600 }, function (err) {
    if (err) {
        console.error("Error connecting to serial port:", err);
        return;
    }
    console.log("Connected to serial port");

    // Устанавливаем адрес устройства
    client.setID(MODBUS_ADDRESS);
    var date_time = new Date();

    // Запускаем периодический опрос
    setInterval(() => {
        // Читаем 4 16-битных Input Registers (2 регистра по 16 бит для одного значения)
        client.readInputRegisters(REGISTER_ADDRESS, 2, function (err, data) {
            if (err) {
                console.error("Error reading register:", err);
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
});

// Запуск сервера
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});