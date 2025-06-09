// Updated WhatsappMessage class
const BaseModel = require('./base/BaseModel');

class WhatsappMessage extends BaseModel {
  constructor(webhookData) {
    super();

    const entry = webhookData.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const contact = value?.contacts?.[0];
    const message = value?.messages?.[0];

    // Basic webhook info
    this.businessAccountId = entry?.id;
    this.phoneNumberId = value?.metadata?.phone_number_id;
    this.displayPhoneNumber = value?.metadata?.display_phone_number;

    // Contact info
    this.contactName = contact?.profile?.name;
    this.contactWaId = contact?.wa_id;

    // Message info
    this.id = message?.id;
    this.from = message?.from;
    this.timestamp = message?.timestamp;
    this.messageType = message?.type;
    this.messageBody = message?.text?.body;

    // Processing status
    this.isProcessed = false;
  }
}

module.exports = { WhatsappMessage };
