// controllers/whatsappController.js
const createBaseController = require('./base/controllerFactory');
const whatsappService = require('../services/whatsappService');
// const { BadRequestError, UnauthorizedError } = require('../utils/errors');

// const VERIFY_TOKEN = 'my_custom_token';

const baseController = createBaseController(whatsappService);

const whatsappController = {
  ...baseController,

  async wphook(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('Webhook request received:', { mode, token, challenge });
      console.log('Req:', req.body);

      const message = await whatsappService.processWebhook(req.body);

      // if (!mode || !token) {
      //   throw new BadRequestError('Missing mode or token in query');
      // }

      // if (mode !== 'subscribe' || token !== VERIFY_TOKEN) {
      //   throw new UnauthorizedError('Token verification failed');
      // }

      console.log('Webhook verified');
      baseController.handleResponse(res, message);
    } catch (error) {
      baseController.handleError(res, error);
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
