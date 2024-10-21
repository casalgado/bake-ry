import { admin } from "../config/firebase";

class User {
  constructor(id, data) {
    this.id = id;
    this.email = data.email;
    this.role = data.role;
    this.bakeryId = data.bakeryId;
    this.name = data.name;
  }

  static async create(userData) {
    const { email, password, role, bakeryId, name } = userData;

    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
      });

      await admin
        .auth()
        .setCustomUserClaims(userRecord.uid, { role, bakeryId });

      const userRef = admin.firestore().collection("users").doc(userRecord.uid);
      await userRef.set({
        email,
        role,
        bakeryId,
        name,
      });

      return new User(userRecord.uid, { email, role, bakeryId, name });
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const doc = await admin.firestore().collection("users").doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return new User(doc.id, doc.data());
    } catch (error) {
      console.error("Error finding user:", error);
      throw error;
    }
  }
}

export default User;
