const { db } = require("../../config/firebase");
const { Recipe } = require("../../models/Recipe");

// Mock Firestore Timestamp
class FirestoreTimestamp {
  constructor(seconds, nanoseconds) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }

  toDate() {
    return new Date(this._seconds * 1000);
  }
}

describe('Recipe Model Timestamp Handling', () => {
  it('should properly convert Firestore timestamps to Date objects', () => {
    // Arrange
    const now = new Date();
    const firestoreDoc = {
      id: 'test-recipe',
      data: () => ({
        name: 'Test Recipe',
        createdAt: new FirestoreTimestamp(Math.floor(now.getTime() / 1000), 0),
        updatedAt: new FirestoreTimestamp(Math.floor(now.getTime() / 1000), 0),
      }),
    };

    // Act
    const recipe = Recipe.fromFirestore(firestoreDoc);

    // Assert
    expect(recipe.createdAt).toBeInstanceOf(Date);
    expect(recipe.updatedAt).toBeInstanceOf(Date);
    expect(recipe.createdAt.getTime()).toBe(
      Math.floor(now.getTime() / 1000) * 1000
    );
  });

  it('should handle missing timestamp fields gracefully', () => {
    // Arrange
    const firestoreDoc = {
      id: 'test-recipe',
      data: () => ({
        name: 'Test Recipe',
        // Timestamps omitted
      }),
    };

    // Act
    const recipe = Recipe.fromFirestore(firestoreDoc);

    // Assert
    expect(recipe.createdAt).toBeInstanceOf(Date);
    expect(recipe.updatedAt).toBeInstanceOf(Date);
  });

  it('should maintain timestamp consistency when converting to Firestore', () => {
    // Arrange
    const now = new Date();
    const recipe = new Recipe({
      name: 'Test Recipe',
      createdAt: now,
      updatedAt: now,
    });

    // Act
    const firestoreData = recipe.toFirestore();

    // Assert
    expect(firestoreData.createdAt).toBeInstanceOf(Date);
    expect(firestoreData.createdAt.getTime()).toBe(now.getTime());
  });
});