// services/whatsappService.js
const { db } = require('../config/firebase');
const { WhatsappMessage } = require('../models/WhatsappMessage');
const createBaseService = require('./base/serviceFactory');

const createWhatsAppService = () => {
  const baseService = createBaseService('whatsapp_messages', WhatsappMessage);

  const processWebhook = async (webhookData) => {
    try {
      return await db.runTransaction(async (transaction) => {
        const message = new WhatsappMessage(webhookData);

        // Check if message already exists to avoid duplicates
        const existingMessageQuery = baseService.getCollectionRef()
          .where('messageId', '==', message.messageId);

        const existingMessages = await transaction.get(existingMessageQuery);

        if (!existingMessages.empty) {
          console.log(`Message ${message.messageId} already processed`);
          return existingMessages.docs[0].data();
        }

        // Create new message record
        const messageRef = baseService.getCollectionRef().doc();
        message.id = messageRef.id;

        transaction.set(messageRef, message.toFirestore());

        console.log(`New WhatsApp message saved: ${message.messageId}`);
        return message;
      });
    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error);
      throw error;
    }
  };

  const markAsProcessed = async (messageId) => {
    try {
      const messageRef = baseService.getCollectionRef().doc(messageId);

      await messageRef.update({
        isProcessed: true,
        processedAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`Message ${messageId} marked as processed`);
    } catch (error) {
      console.error('Error marking message as processed:', error);
      throw error;
    }
  };

  const getUnprocessedMessages = async () => {
    try {
      const snapshot = await baseService.getCollectionRef()
        .where('isProcessed', '==', false)
        .orderBy('createdAt', 'asc')
        .get();

      return snapshot.docs.map(doc => WhatsappMessage.fromFirestore(doc));
    } catch (error) {
      console.error('Error getting unprocessed messages:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    processWebhook,
    markAsProcessed,
    getUnprocessedMessages,
  };
};

module.exports = createWhatsAppService();
