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
router.get('/:roomId', authMiddleware, async (req, res) => {
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
        console.log('>> roomId:', req.params.roomId); // Log roomId
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


/**
 * @swagger
 * /api/theater/rooms/{roomId}/edit:
 *   put:
 *     summary: Cập nhật thông tin phòng chiếu
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phòng chiếu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *       200:
 *         description: Cập nhật thành công.
 *       400:
 *         description: Dữ liệu không hợp lệ.
 *       404:
 *         description: Không tìm thấy phòng.
 *       500:
 *         description: Lỗi máy chủ.
 */
router.put('/:roomId/edit', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { roomName, rows, columns, roomType, normalPrice, vipPrice } = req.body;

    // Validate đầu vào
    if (
      !roomName || typeof roomName !== 'string' ||
      !rows || !columns || !roomType ||
      typeof normalPrice !== 'number' || typeof vipPrice !== 'number'
    ) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    }

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }

    // Cập nhật các thông tin cơ bản
    room.roomName = roomName;
    room.rows = rows;
    room.columns = columns;
    room.roomType = roomType;
    room.quantity = rows * columns;

    // Tạo lại danh sách ghế với các thông tin mới
    const newSeats = [];
    for (let r = 1; r <= rows; r++) {
      const rowLetter = String.fromCharCode(64 + r);
      for (let c = 1; c <= columns; c++) {
        const label = `${rowLetter}${c}`;
        const oldSeat = room.seats.find(seat => seat.label === label);
        const type = oldSeat?.type || 'Normal';
        const price = type === 'VIP' ? vipPrice : normalPrice;

        newSeats.push({ row: r, column: c, label, type, price });
      }
    }

    room.seats = newSeats;
    await room.save();

    res.status(200).json({ message: 'Cập nhật phòng thành công.', room });
  } catch (error) {
    console.error('Lỗi cập nhật phòng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật phòng.' });
  }
});




/**
 * @swagger
 * /api/theater/rooms/{roomId}:
 *   patch:
 *     summary: Cập nhật thông tin phòng chiếu
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomName:
 *                 type: string
 *               rows:
 *                 type: number
 *               columns:
 *                 type: number
 *               roomType:
 *                 type: string
 *                 enum: ["2D", "3D", "IMAX"]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy phòng
 */
router.patch('/:roomId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { roomName, rows, columns, roomType } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }

    let updated = false;

    if (roomName && typeof roomName === 'string') {
      room.roomName = roomName;
      updated = true;
    }

    if (
      typeof rows === 'number' &&
      typeof columns === 'number' &&
      rows > 0 &&
      columns > 0 &&
      (rows !== room.rows || columns !== room.columns)
    ) {
      room.rows = rows;
      room.columns = columns;
      room.quantity = rows * columns;

      // Regenerate seats (default Normal, use old prices if possible)
      const newSeats = [];
      const normalPrice = room.seats[0]?.price || 50000;
      for (let r = 1; r <= rows; r++) {
        const rowLetter = String.fromCharCode(64 + r);
        for (let c = 1; c <= columns; c++) {
          newSeats.push({
            row: r,
            column: c,
            label: `${rowLetter}${c}`,
            type: 'Normal',
            price: normalPrice,
          });
        }
      }
      room.seats = newSeats;
      updated = true;
    }

    if (roomType && ['2D', '3D', 'IMAX'].includes(roomType)) {
      room.roomType = roomType;
      updated = true;
    }

    if (!updated) {
      return res.status(400).json({ message: 'Không có dữ liệu nào được thay đổi.' });
    }

    await room.save();

    res.status(200).json({ message: 'Cập nhật phòng chiếu thành công.', room });
  } catch (err) {
    console.error('Lỗi khi cập nhật phòng:', err.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật phòng.' });
  }
});

/**
 * @swagger
 * /api/theater/rooms/{roomId}/update-prices:
 *   patch:
 *     summary: Cập nhật giá ghế VIP và Normal cho tất cả các ghế hiện có (không thay đổi loại ghế)
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
 *               vipPrice:
 *                 type: number
 *               normalPrice:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cập nhật giá ghế thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy phòng
 */
router.patch('/:roomId/update-prices', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { vipPrice, normalPrice } = req.body;

    if (
      (typeof vipPrice !== 'number' && typeof normalPrice !== 'number')
    ) {
      return res.status(400).json({ message: 'Cần cung cấp ít nhất một giá để cập nhật.' });
    }

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }

    room.seats = room.seats.map(seat => {
      if (seat.type === 'VIP' && typeof vipPrice === 'number') {
        seat.price = vipPrice;
      }
      if (seat.type === 'Normal' && typeof normalPrice === 'number') {
        seat.price = normalPrice;
      }
      return seat;
    });

    await room.save();

    res.status(200).json({
      message: 'Cập nhật giá ghế thành công.',
      updated: { vipPrice, normalPrice }
    });
  } catch (err) {
    console.error('Lỗi cập nhật giá ghế:', err.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật giá ghế.' });
  }
});


// [Swagger] PATCH - Update is_actived status
/**
 * @swagger
 * /api/theater/rooms/{roomId}/status:
 *   patch:
 *     summary: Kích hoạt/Vô hiệu hóa phòng chiếu
 *     tags: [Room Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_actived:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công.
 *       404:
 *         description: Không tìm thấy phòng.
 */
router.patch('/:roomId/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { is_actived } = req.body;
    const room = await Room.findOneAndUpdate(
      { roomId: req.params.roomId },
      { is_actived },
      { new: true }
    );
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }
    res.status(200).json({ message: 'Cập nhật trạng thái thành công.', room });
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái:', err);
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});

// [Swagger] DELETE - Xóa vĩnh viễn phòng chiếu
/**
 * @swagger
 * /api/theater/rooms/{roomId}/hard_delete:
 *   delete:
 *     summary: Xóa vĩnh viễn phòng chiếu
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
 *         description: Phòng đã bị xóa vĩnh viễn.
 *       404:
 *         description: Không tìm thấy phòng.
 */
router.delete('/:roomId/hard_delete', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await Room.findOneAndDelete({ roomId: req.params.roomId });
    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }
    res.status(200).json({ message: `Phòng "${req.params.roomId}" đã bị xóa vĩnh viễn.` });
  } catch (err) {
    console.error('Lỗi xóa vĩnh viễn:', err);
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
});


// GET /api/theater/rooms/:roomId/occupied-seats
router.get('/:roomId/occupied-seats', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.status(200).json({ occupiedSeats: room.occupiedSeats || [] });
  } catch (error) {
    console.error('Error fetching occupied seats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;

