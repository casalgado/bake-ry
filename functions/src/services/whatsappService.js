// services/whatsappService.js
const { db } = require('../config/firebase');
const { WhatsappMessage } = require('../models/WhatsappMessage');
const createBaseService = require('./base/serviceFactory');

const createWhatsAppService = () => {
  const baseService = createBaseService('whatsapp_messages', WhatsappMessage, 'bakeries/{bakeryId}');

  const processWebhook = async (webhookData) => {
    try {
      return await db.runTransaction(async (transaction) => {
        const message = new WhatsappMessage(webhookData);
        const bakeryId = 'es-alimento-dev';

        // Validate that we have a messageId
        if (!message.id) {
          throw new Error('No id found in webhook data');
        }

        // Use messageId as document ID
        const messageRef = baseService.getCollectionRef(bakeryId).doc(message.id);

        // Check if message already exists by trying to get the document
        const existingMessageDoc = await transaction.get(messageRef);

        if (existingMessageDoc.exists) {
          console.log(`Message ${message.id} already processed`);
          return existingMessageDoc.data();
        }

        // Create new message record using messageId as document ID
        transaction.set(messageRef, message.toFirestore());

        console.log(`New WhatsApp message saved with ID: ${message.id}`);
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
