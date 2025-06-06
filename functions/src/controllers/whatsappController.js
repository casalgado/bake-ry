// controllers/whatsappController.js
const createBaseController = require('./base/controllerFactory');
const whatsappService = require('../services/whatsappService');

const VERIFY_TOKEN = 'my_custom_token';

const baseController = createBaseController(whatsappService);

const whatsappController = {
  ...baseController,

  async wphook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('Webhook request received:', { mode, token, challenge });
    console.log('Req:', req.body);

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  },
};

module.exports = whatsappController;

/*
Body: {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "720766633831915",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15556579798",
              "phone_number_id": "695864910270065"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Carlos Alberto"
                },
                "wa_id": "573155433505"
              }
            ],
            "messages": [
              {
                "from": "573155433505",
                "id": "wamid.HBgMNTczMTU1NDMzNTA1FQIAEhgUM0ZGMkRBQkQzMEJFNEMxNjNDRUYA",
                "timestamp": "1749221456",
                "text": {
                  "body": "toh"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
  */
