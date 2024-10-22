# 2024-10-20

- Added user roles and permissions
- Added user controller
- Added auth controller
- created first user

next steps is being able to create bakeries and assign users to them
also create products and orders

then i plan to set up permissions for each role

# 2024-10-21

- tried to move to import syntax and rolled back because it was causing issues with jest
- wrote tests for bakery model and service
- moved custom token to its own file and commented out the call to it in firebase.js (for testing purposes)

next steps:

- write full tests for bakery service
- create products and orders
- write tests for products and orders

# 2024-10-22

- database relationships
  graph TD
  subgraph Firestore Collections
  bakeries[/bakeries/]
  products[/products/]
  orders[/orders/]
  ingredients[/ingredients/]
  recipes[/recipes/]
  orderItems[/orderItems/]
  end

      bakeries --> |contains| products
      bakeries --> |contains| orders
      bakeries --> |contains| ingredients
      products --> |references| recipes
      orders --> |contains| orderItems
      recipes --> |references| ingredients
