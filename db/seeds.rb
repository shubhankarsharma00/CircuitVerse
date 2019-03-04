# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rails db:seed command (or created alongside the database with db:setup).
#
# Examples:
#
#   movies = Movie.create([{ name: 'Star Wars' }, { name: 'Lord of the Rings' }])
#   Character.create(name: 'Luke', movie: movies.first)

User.create(name: 'Admin',
  email: 'admin@circuitverse.org',
  password: 'password',
  admin: true
)

Tag.create(name: "Recipe")
Tag.create(name: "Travel")
Tag.create(name: "Fashion/Beauty")
Tag.create(name: "Humour")