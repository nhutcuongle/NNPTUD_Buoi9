var express = require("express");
var router = express.Router();
let mongoose = require("mongoose");
let messageModel = require("../schemas/messages");
let { CheckLogin } = require('../utils/authHandler');
let { uploadAny } = require('../utils/uploadHandler');

router.get("/", CheckLogin, async function (req, res, next) {
  try {
    const currentUserId = req.user._id;

    const messages = await messageModel.aggregate([
      {
        $match: {
          $or: [
            { from: currentUserId },
            { to: currentUserId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$from", currentUserId] },
              "$to",
              "$from"
            ]
          },
          lastMessage: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$lastMessage" }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    await messageModel.populate(messages, { path: 'from to', select: 'username fullName avatarUrl' });

    res.status(200).send(messages);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

router.get("/:userID", CheckLogin, async function (req, res, next) {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userID;

    const messages = await messageModel.find({
      $or: [
        { from: currentUserId, to: targetUserId },
        { from: targetUserId, to: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    res.status(200).send(messages);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

router.post("/", CheckLogin, uploadAny.single('file'), async function (req, res, next) {
    try {
        const currentUserId = req.user._id;
        const targetUserId = req.body.to;
        
        if (!targetUserId) {
            return res.status(400).send({ message: "Thiếu trường 'to' (chỉ định userID người nhận)" });
        }

        let msgType = "text";
        let msgText = req.body.text; 

        if (req.file) {
            msgType = "file";
            msgText = req.file.path;
        } else if (!msgText) {
            return res.status(400).send({ message: "Cần cung cấp nội dung text hoặc file đính kèm" });
        }

        const newMessage = await messageModel.create({
            from: currentUserId,
            to: targetUserId,
            messageContent: {
                type: msgType,
                text: msgText
            }
        });

        res.status(201).send(newMessage);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
