
const { getDB } = require("../config/db");

const User = {
  collection() {
    return getDB().collection("users");
  },

  async create(userData) {
    return this.collection().insertOne({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  },

  async findByEmail(email) {
    return this.collection().findOne({
      email: email.trim().toLowerCase()
    });
  },

  async findById(id) {
    const { ObjectId } = require("mongodb");

    return this.collection().findOne({
      _id: new ObjectId(id)
    });
  }
};

module.exports = User;
