const express = require('express');
const mongoose = require('mongoose');
const Room = require('../../models/Room');
const authMiddleware = require('../../middleware/authMiddleware');
const adminMiddleware = require('../../middleware/adminMiddleware');
const router = express.Router();

/**
 * @swagger
 * /api/theater/rooms/new_room:
 *   post:
 *     summary: Tạo một phòng mới cùng danh sách ghế
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomName
 *               - rows
 *               - columns
 *               - roomType
 *               - normalPrice
 *               - vipPrice
 *             properties:
 *               roomName:
 *                 type: string
 *               rows:
 *                 type: integer
 *               columns:
 *                 type: integer
 *               roomType:
 *                 type: string
 *                 enum: ["2D", "3D", "IMAX"]
 *               normalPrice:
 *                 type: number
 *               vipPrice:
 *                 type: number
 *     responses:
 *       201:
 *         description: Phòng mới đã được tạo thành công.
 *       400:
 *         description: Thiếu dữ liệu bắt buộc.
 *       500:
 *         description: Lỗi máy chủ.
 */
router.post('/new_room', authMiddleware, adminMiddleware, async (req, res) => {
    const { roomName, rows, columns, roomType, normalPrice, vipPrice } = req.body;

    try {
        // Kiểm tra dữ liệu đầu vào
        if (
            !roomName || typeof roomName !== 'string' ||
            !rows || !columns || !roomType ||
            typeof normalPrice !== 'number' || typeof vipPrice !== 'number'
        ) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ và đúng định dạng dữ liệu.' });
        }

        if (rows <= 0 || columns <= 0 || normalPrice <= 0 || vipPrice <= 0) {
            return res.status(400).json({ message: 'Giá trị rows, columns, hoặc giá ghế không hợp lệ.' });
        }

        const quantity = rows * columns;

        // Tạo danh sách ghế
        const seats = [];
        for (let r = 1; r <= rows; r++) {
            const rowLetter = String.fromCharCode(64 + r);
            for (let c = 1; c <= columns; c++) {
                const type = 'Normal';
                const price = normalPrice;

                seats.push({ row: r, column: c, label: `${rowLetter}${c}`, type, price });
            }
        }

        const newRoom = new Room({
            roomName,
            rows,
            columns,
            quantity,
            roomType,
            seats
        });

        await newRoom.save();

        res.status(201).json({
            message: 'Phòng mới đã được tạo thành công.',
            roomId: newRoom.roomId
        });
    } catch (error) {
        console.error('Lỗi khi tạo phòng:', error.message);
        res.status(500).send('Lỗi máy chủ khi tạo phòng.');
    }
});

/**
 * @swagger
 * /api/theater/rooms:
 *   get:
 *     summary: Lấy danh sách tất cả các phòng
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách phòng thành công.
 *       500:
 *         description: Lỗi máy chủ.
 */
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const rooms = await Room.find().select('-__v');
        res.status(200).json({ message: 'Lấy danh sách phòng thành công.', rooms });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách phòng:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách phòng.');
    }
});

/**
 * @swagger
 * /api/theater/rooms/{roomId}:
 *   get:
 *     summary: Lấy thông tin chi tiết một phòng
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thông tin phòng thành công.
 *       404:
 *         description: Không tìm thấy phòng.
 *       500:
 *         description: Lỗi máy chủ.
 */
router.get('/:roomId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId }).select('-__v -_id');
        if (!room) {
            return res.status(404).json({ message: 'Không tìm thấy phòng.' });
        }
        res.status(200).json({ message: 'Lấy dữ liệu phòng thành công.', room });
    } catch (error) {
        console.error('Lỗi khi lấy phòng:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy dữ liệu phòng.');
    }
});

/**
 * @swagger
 * /api/theater/rooms/{roomId}/update-seat-types:
 *   patch:
 *     summary: Cập nhật loại ghế (VIP/Normal) cho phòng
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phòng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vipSeats:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách ghế VIP
 *               normalSeats:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách ghế thường
 *               vipPrice:
 *                 type: number
 *                 description: Giá ghế VIP
 *               normalPrice:
 *                 type: number
 *                 description: Giá ghế thường
 *     responses:
 *       200:
 *         description: Cập nhật ghế thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy phòng
 *       500:
 *         description: Lỗi máy chủ
 */
router.patch('/:roomId/update-seat-types', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { vipSeats = [], normalSeats = [], vipPrice, normalPrice } = req.body;

    if (
      (!Array.isArray(vipSeats) && !Array.isArray(normalSeats)) ||
      typeof vipPrice !== 'number' ||
      typeof normalPrice !== 'number'
    ) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    }

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }

    room.seats = room.seats.map(seat => {
      if (vipSeats.includes(seat.label)) {
        seat.type = 'VIP';
        seat.price = vipPrice;
      } else if (normalSeats.includes(seat.label)) {
        seat.type = 'Normal';
        seat.price = normalPrice;
      }
      return seat;
    });

    await room.save();

    res.status(200).json({
      message: 'Cập nhật loại ghế thành công.',
      updated: {
        vipSeats,
        normalSeats
      }
    });
  } catch (err) {
    console.error('❌ Lỗi cập nhật ghế:', err.message);
    res.status(500).send('Lỗi máy chủ khi cập nhật loại ghế.');
  }
});



/**
 * @swagger
 * /api/theater/rooms/{roomId}/delete:
 *   delete:
 *     summary: Đập phòng (xóa mềm)
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Phòng đã bị xóa mềm.
 *       404:
 *         description: Không tìm thấy phòng.
 *       500:
 *         description: Lỗi máy chủ.
 */
router.delete('/:roomId/delete', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });

        if (!room) {
            return res.status(404).json({ message: 'Không tìm thấy phòng.' });
        }

        if (room.is_deleted) {
            return res.status(400).json({ message: 'Phòng này đã bị xóa trước đó.' });
        }

        room.is_deleted = true;
        room.is_actived = false;
        await room.save();

        res.status(200).json({ message: `Phòng "${room.roomId}" đã được xóa mềm.` });
    } catch (error) {
        console.error('Lỗi khi xóa phòng:', error.message);
        res.status(500).send('Lỗi máy chủ khi xóa phòng.');
    }
});

module.exports = router;
