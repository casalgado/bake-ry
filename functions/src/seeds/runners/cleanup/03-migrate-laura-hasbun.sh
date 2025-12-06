#!/bin/bash
# =============================================================================
# Script 3: Migrate Laura Hasbun
# =============================================================================
# Phone: 573003251726
# Source (DELETE): kjKTorgsHasvaRSgv1NJ - "Laura Hasbun" (older)
# Target (KEEP):   vxQNieZCJeiqDY1vyJ0Y - "Laura Hasbun" (newer)
# Note: Same name, keeping newer (more recent activity)
# =============================================================================

# Check if TOKEN is set
if [ -z "$TOKEN" ]; then
    echo "ERROR: TOKEN environment variable is not set"
    echo "Usage: TOKEN=\"your-token\" bash $0"
    exit 1
fi

BASE="https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY="diana_lee"
SOURCE_USER="kjKTorgsHasvaRSgv1NJ"
TARGET_USER="vxQNieZCJeiqDY1vyJ0Y"

echo "=============================================="
echo "MIGRATE: Laura Hasbun (older -> newer)"
echo "Phone: 573003251726"
echo "Bakery: $BAKERY"
echo "=============================================="
echo ""

# Step 1: Get order ID from source user's history
echo "=== Step 1: Get order ID from source user's history ==="
echo "Source User: $SOURCE_USER (Laura Hasbun - older)"
echo ""
echo "Response:"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/$SOURCE_USER/history"
echo ""
echo ""
echo ">>> Copy the order ID from above and continue to Step 2"
echo ">>> Press Enter to continue..."
read

# Step 2: Get full order from /orders endpoint
echo "=== Step 2: Get full order from /orders endpoint ==="
echo "Enter the order ID from Step 1:"
read ORDER_ID
echo ""
echo "Fetching order: $ORDER_ID"
echo ""
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/orders/$ORDER_ID"
echo ""
echo ""
echo ">>> Save this order data - you'll need it for Step 4"
echo ">>> Press Enter to continue..."
read

# Step 3: Get target user info
echo "=== Step 3: Get target user info ==="
echo "Target User: $TARGET_USER (Laura Hasbun - newer)"
echo ""
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/$TARGET_USER"
echo ""
echo ""
echo ">>> Note the target user's name, email, phone for the new order"
echo ">>> Press Enter to continue..."
read

# Step 4: Create order for target user
echo "=== Step 4: Create order for target user ==="
echo ""
echo "You need to manually construct the POST request using:"
echo "  - Order data from Step 2"
echo "  - Target user info from Step 3"
echo ""
echo "Template:"
echo 'curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \'
echo '  -d '"'"'{'
echo '    "userId": "'"$TARGET_USER"'",'
echo '    "userName": "[TARGET USER NAME]",'
echo '    "userEmail": "[TARGET USER EMAIL]",'
echo '    "userPhone": "[TARGET USER PHONE]",'
echo '    ... (copy rest of order fields from Step 2)'
echo '    "internalNotes": "[Migrated from user '"$SOURCE_USER"']"'
echo '  }'"'"' \'
echo '  "'"$BASE/bakeries/$BAKERY/orders"'"'
echo ""
echo ">>> After creating the order, press Enter to continue..."
read

# Step 5: Delete original order
echo "=== Step 5: Delete original order ==="
echo "Order ID: $ORDER_ID"
echo ""
echo "Deleting order..."
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/orders/$ORDER_ID"
echo ""
echo ""
echo ">>> Press Enter to continue..."
read

# Step 6: Delete source user
echo "=== Step 6: Delete source user ==="
echo "Source User: $SOURCE_USER"
echo ""
echo "Deleting user..."
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/$SOURCE_USER"
echo ""
echo ""

# Step 7: Verify
echo "=== Step 7: Verify migration ==="
echo ""
echo "Source user (should be isDeleted: true):"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/$SOURCE_USER"
echo ""
echo ""
echo "Target user's history (should include migrated order):"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/$TARGET_USER/history"
echo ""
echo ""

echo "=============================================="
echo "DONE - Migration complete"
echo "=============================================="
