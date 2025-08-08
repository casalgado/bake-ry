# Frontend Integration Guide: Subscription System

## Overview
This guide provides the frontend team with all necessary information to implement the subscription management UI for the bakery management application. The backend subscription system is fully implemented and tested, providing JWT-based access control and comprehensive subscription management.

## Authentication & Authorization

### JWT Token Structure
The backend enhances Firebase JWT tokens with subscription information:
```javascript
// JWT Custom Claims (available in token)
{
  role: 'system_admin' | 'bakery_admin' | 'bakery_staff' | ...,
  bakeryId: 'bakery-123',
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PAYMENT_FAILED',
  subscriptionTier: 'ALWAYS_FREE' | 'BASIC' | 'PREMIUM'
}
```

### Access Control Logic
```javascript
// Frontend access control logic
const canWrite = (userToken) => {
  const claims = userToken.claims;
  
  // ALWAYS_FREE tier can always write
  if (claims.subscriptionTier === 'ALWAYS_FREE') return true;
  
  // Active subscriptions and trials can write
  if (['TRIAL', 'ACTIVE'].includes(claims.subscriptionStatus)) return true;
  
  // PAYMENT_FAILED has grace period (backend handles the date logic)
  if (claims.subscriptionStatus === 'PAYMENT_FAILED') return true;
  
  // SUSPENDED and CANCELLED are read-only
  return false;
};
```

## Backend API Endpoints

### Base URL
```
Production: https://your-region-project-id.cloudfunctions.net/bake
Development: http://localhost:5001/project-id/region/bake
```

### Subscription Management

#### 1. Get Subscription Information
```http
GET /bakeries/{bakeryId}/settings/default
Authorization: Bearer {firebase-jwt-token}
```

**Response Structure**:
```json
{
  "id": "default",
  "bakeryId": "bakery-123",
  "subscription": {
    "status": "TRIAL",
    "tier": "BASIC",
    "subscriptionStartDate": "2024-01-01T00:00:00Z",
    "amount": 99000,
    "currency": "COP",
    "savedCardId": "card-token-123",
    "recurringPaymentId": "payment-456",
    "consecutiveFailures": 0
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-25T00:00:00Z"
}
```

#### 2. Update Subscription Settings
```http
PATCH /bakeries/{bakeryId}/settings/default
Authorization: Bearer {firebase-jwt-token}
Content-Type: application/json
```

**Update Subscription Status**:
```json
{
  "subscription": {
    "status": "ACTIVE",
    "tier": "PREMIUM"
  }
}
```

**Set Up New Subscription with Card**:
```json
{
  "subscription": {
    "savedCardId": "card-token-from-payu",
    "tier": "BASIC",
    "amount": 99000
  }
}
```

**Subscription Actions**:
```json
// Retry failed payment
{
  "subscription": {
    "_action": "retry_payment"
  }
}

// Cancel subscription
{
  "subscription": {
    "_action": "cancel_subscription"
  }
}

// Reactivate subscription
{
  "subscription": {
    "_action": "reactivate_subscription"
  }
}
```

### PayU Card Management

#### 1. Get Saved Cards
```http
GET /bakeries/{bakeryId}/payu/cards
Authorization: Bearer {firebase-jwt-token}
```

#### 2. Save New Card
```http
POST /bakeries/{bakeryId}/payu/cards
Authorization: Bearer {firebase-jwt-token}
Content-Type: application/json
```

```json
{
  "cardNumber": "4111111111111111",
  "expiryMonth": "12",
  "expiryYear": "2025",
  "cardHolderName": "John Doe",
  "cvv": "123"
}
```

### Admin Endpoints (System Admin Only)

#### 1. View Subscriptions Due for Billing
```http
GET /admin/billing/due
Authorization: Bearer {system-admin-jwt-token}
```

**Response**:
```json
{
  "success": true,
  "count": 2,
  "subscriptions": [
    {
      "bakeryId": "bakery-1",
      "status": "ACTIVE",
      "tier": "BASIC",
      "nextBillingDate": "2024-02-01T00:00:00Z",
      "consecutiveFailures": 0
    }
  ],
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

#### 2. Process All Billing
```http
POST /admin/billing/process
Authorization: Bearer {system-admin-jwt-token}
```

**Response**:
```json
{
  "success": true,
  "results": {
    "processed": 5,
    "successful": 4,
    "failed": 1,
    "suspended": 0,
    "errors": []
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

#### 3. Retry Specific Subscription
```http
POST /admin/billing/retry/{bakeryId}
Authorization: Bearer {system-admin-jwt-token}
Content-Type: application/json
```

```json
{
  "recurringPaymentId": "payment-456"
}
```

## Vue.js Implementation (Script Setup + Tailwind)

### 1. Subscription Status Component
Create a component to display current subscription status with appropriate UI states:

```vue
<template>
  <div :class="statusClasses" class="p-6 rounded-lg border">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold" :class="textClasses">
          {{ statusMessage }}
        </h3>
        <p class="text-sm text-gray-600 mt-1">
          {{ statusDescription }}
        </p>
      </div>
      <div :class="badgeClasses" class="px-3 py-1 rounded-full text-sm font-medium">
        {{ subscription.status }}
      </div>
    </div>
    
    <!-- Action buttons based on status -->
    <div class="mt-4" v-if="showActions">
      <button
        v-if="subscription.status === 'PAYMENT_FAILED'"
        @click="$emit('retry-payment')"
        class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 mr-3"
      >
        Retry Payment
      </button>
      
      <button
        v-if="subscription.status === 'SUSPENDED'"
        @click="$emit('reactivate')"
        class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 mr-3"
      >
        Reactivate Subscription
      </button>
      
      <button
        v-if="['ACTIVE', 'TRIAL'].includes(subscription.status)"
        @click="$emit('cancel')"
        class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
      >
        Cancel Subscription
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  subscription: {
    type: Object,
    required: true
  },
  userClaims: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['retry-payment', 'reactivate', 'cancel'])

const remainingTrialDays = computed(() => {
  if (props.subscription.status !== 'TRIAL') return 0
  const startDate = new Date(props.subscription.subscriptionStartDate)
  const trialEndDate = new Date(startDate)
  trialEndDate.setDate(trialEndDate.getDate() + 30)
  
  const today = new Date()
  const diffTime = trialEndDate - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

const statusClasses = computed(() => {
  const base = 'border-l-4'
  switch (props.subscription.status) {
    case 'TRIAL': return `${base} border-blue-500 bg-blue-50`
    case 'ACTIVE': return `${base} border-green-500 bg-green-50`
    case 'PAYMENT_FAILED': return `${base} border-orange-500 bg-orange-50`
    case 'SUSPENDED': return `${base} border-red-500 bg-red-50`
    case 'CANCELLED': return `${base} border-gray-500 bg-gray-50`
    default: return `${base} border-gray-500 bg-gray-50`
  }
})

const textClasses = computed(() => {
  switch (props.subscription.status) {
    case 'TRIAL': return 'text-blue-800'
    case 'ACTIVE': return 'text-green-800'
    case 'PAYMENT_FAILED': return 'text-orange-800'
    case 'SUSPENDED': return 'text-red-800'
    case 'CANCELLED': return 'text-gray-800'
    default: return 'text-gray-800'
  }
})

const badgeClasses = computed(() => {
  switch (props.subscription.status) {
    case 'TRIAL': return 'bg-blue-100 text-blue-800'
    case 'ACTIVE': return 'bg-green-100 text-green-800'
    case 'PAYMENT_FAILED': return 'bg-orange-100 text-orange-800'
    case 'SUSPENDED': return 'bg-red-100 text-red-800'
    case 'CANCELLED': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
})

const statusMessage = computed(() => {
  switch (props.subscription.status) {
    case 'TRIAL':
      return `Trial Period - ${remainingTrialDays.value} days remaining`
    case 'ACTIVE':
      return 'Subscription Active'
    case 'PAYMENT_FAILED':
      return 'Payment Failed - Grace Period Active'
    case 'SUSPENDED':
      return 'Subscription Suspended'
    case 'CANCELLED':
      return 'Subscription Cancelled'
    default:
      return 'Unknown Status'
  }
})

const statusDescription = computed(() => {
  switch (props.subscription.status) {
    case 'TRIAL':
      return 'Enjoy full access during your trial period'
    case 'ACTIVE':
      return `Next billing: $${(props.subscription.amount / 100).toFixed(2)} ${props.subscription.currency}`
    case 'PAYMENT_FAILED':
      return 'Please update your payment method to avoid service interruption'
    case 'SUSPENDED':
      return 'Your account is suspended. Update payment to restore access'
    case 'CANCELLED':
      return 'Your subscription has been cancelled'
    default:
      return ''
  }
})

const showActions = computed(() => {
  return ['PAYMENT_FAILED', 'SUSPENDED', 'ACTIVE', 'TRIAL'].includes(props.subscription.status)
})
</script>
```
```

### 2. Access Control Composable
Create a Vue composable for checking write permissions:

```js
// composables/useSubscriptionAccess.js
import { computed, ref } from 'vue'
import { useFirebaseAuth } from './useFirebaseAuth' // Your Firebase auth composable

export function useSubscriptionAccess() {
  const { user, claims } = useFirebaseAuth()
  
  const canWrite = computed(() => {
    if (!claims.value) return false
    
    // ALWAYS_FREE tier can always write
    if (claims.value.subscriptionTier === 'ALWAYS_FREE') return true
    
    // Active subscriptions and trials can write
    if (['TRIAL', 'ACTIVE', 'PAYMENT_FAILED'].includes(claims.value.subscriptionStatus)) {
      return true
    }
    
    return false
  })
  
  const canRead = computed(() => true) // All subscriptions can read
  
  const subscriptionStatus = computed(() => claims.value?.subscriptionStatus)
  const subscriptionTier = computed(() => claims.value?.subscriptionTier)
  
  const isInTrial = computed(() => subscriptionStatus.value === 'TRIAL')
  const isActive = computed(() => subscriptionStatus.value === 'ACTIVE')
  const isSuspended = computed(() => subscriptionStatus.value === 'SUSPENDED')
  const isPaymentFailed = computed(() => subscriptionStatus.value === 'PAYMENT_FAILED')
  
  return {
    canWrite,
    canRead,
    subscriptionStatus,
    subscriptionTier,
    isInTrial,
    isActive,
    isSuspended,
    isPaymentFailed
  }
}
```

### 3. Subscription Management Page
Key sections to implement:

```vue
<template>
  <div class="max-w-4xl mx-auto p-6 space-y-6">
    <!-- Page Header -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Subscription Management</h1>
      <p class="text-gray-600">Manage your bakery's subscription and billing information</p>
    </div>

    <!-- Current Status Section -->
    <SubscriptionStatus 
      :subscription="subscription" 
      :user-claims="userClaims"
      @retry-payment="handleRetryPayment"
      @reactivate="handleReactivate"
      @cancel="handleCancel"
    />

    <!-- Payment Method Section -->
    <PaymentMethods 
      v-if="subscription && !isAlwaysFree"
      :saved-cards="savedCards"
      :loading="cardsLoading"
      @add-card="handleAddCard"
      @update-card="handleUpdateCard"
      @delete-card="handleDeleteCard"
    />

    <!-- Billing History Section -->
    <BillingHistory 
      v-if="subscription?.recurringPaymentId"
      :bakery-id="bakeryId"
      :recurring-payment-id="subscription.recurringPaymentId"
    />

    <!-- Subscription Plans Section (for upgrades/downgrades) -->
    <SubscriptionPlans
      v-if="showPlans"
      :current-tier="subscription?.tier"
      @select-plan="handlePlanChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/composables/useFirebaseAuth'
import { useSubscriptionAccess } from '@/composables/useSubscriptionAccess'
import { useNotifications } from '@/composables/useNotifications'
import SubscriptionStatus from '@/components/SubscriptionStatus.vue'
import PaymentMethods from '@/components/PaymentMethods.vue'
import BillingHistory from '@/components/BillingHistory.vue'
import SubscriptionPlans from '@/components/SubscriptionPlans.vue'

const router = useRouter()
const { user, claims } = useFirebaseAuth()
const { subscriptionTier } = useSubscriptionAccess()
const { showSuccess, showError } = useNotifications()

// Reactive state
const subscription = ref(null)
const savedCards = ref([])
const loading = ref(true)
const cardsLoading = ref(true)

// Computed properties
const bakeryId = computed(() => claims.value?.bakeryId)
const userClaims = computed(() => claims.value || {})
const isAlwaysFree = computed(() => subscriptionTier.value === 'ALWAYS_FREE')
const showPlans = computed(() => !isAlwaysFree.value && subscription.value?.status !== 'CANCELLED')

// Methods
const fetchSubscription = async () => {
  if (!bakeryId.value) return
  
  try {
    loading.value = true
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/settings/default`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) throw new Error('Failed to fetch subscription')
    
    const data = await response.json()
    subscription.value = data.subscription
  } catch (error) {
    showError('Failed to load subscription information')
    console.error('Error fetching subscription:', error)
  } finally {
    loading.value = false
  }
}

const fetchSavedCards = async () => {
  if (!bakeryId.value || isAlwaysFree.value) return
  
  try {
    cardsLoading.value = true
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/payu/cards`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) throw new Error('Failed to fetch cards')
    
    const data = await response.json()
    savedCards.value = data.items || []
  } catch (error) {
    showError('Failed to load payment methods')
    console.error('Error fetching cards:', error)
  } finally {
    cardsLoading.value = false
  }
}

const handleRetryPayment = async () => {
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/settings/default`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: {
          _action: 'retry_payment'
        }
      })
    })
    
    if (!response.ok) throw new Error('Failed to retry payment')
    
    showSuccess('Payment retry initiated successfully')
    await fetchSubscription()
  } catch (error) {
    showError('Failed to retry payment')
    console.error('Error retrying payment:', error)
  }
}

const handleReactivate = async () => {
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/settings/default`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: {
          _action: 'reactivate_subscription'
        }
      })
    })
    
    if (!response.ok) throw new Error('Failed to reactivate subscription')
    
    showSuccess('Subscription reactivated successfully')
    await fetchSubscription()
  } catch (error) {
    showError('Failed to reactivate subscription')
    console.error('Error reactivating subscription:', error)
  }
}

const handleCancel = async () => {
  if (!confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
    return
  }
  
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/settings/default`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: {
          _action: 'cancel_subscription'
        }
      })
    })
    
    if (!response.ok) throw new Error('Failed to cancel subscription')
    
    showSuccess('Subscription cancelled successfully')
    await fetchSubscription()
  } catch (error) {
    showError('Failed to cancel subscription')
    console.error('Error cancelling subscription:', error)
  }
}

const handleAddCard = async (cardData) => {
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/payu/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cardData)
    })
    
    if (!response.ok) throw new Error('Failed to add card')
    
    showSuccess('Payment method added successfully')
    await fetchSavedCards()
  } catch (error) {
    showError('Failed to add payment method')
    console.error('Error adding card:', error)
  }
}

const handleUpdateCard = async (cardId, cardData) => {
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/payu/cards/${cardId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cardData)
    })
    
    if (!response.ok) throw new Error('Failed to update card')
    
    showSuccess('Payment method updated successfully')
    await fetchSavedCards()
  } catch (error) {
    showError('Failed to update payment method')
    console.error('Error updating card:', error)
  }
}

const handleDeleteCard = async (cardId) => {
  if (!confirm('Are you sure you want to delete this payment method?')) {
    return
  }
  
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/payu/cards/${cardId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) throw new Error('Failed to delete card')
    
    showSuccess('Payment method deleted successfully')
    await fetchSavedCards()
  } catch (error) {
    showError('Failed to delete payment method')
    console.error('Error deleting card:', error)
  }
}

const handlePlanChange = async (newTier) => {
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/api/bakeries/${bakeryId.value}/settings/default`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: {
          tier: newTier
        }
      })
    })
    
    if (!response.ok) throw new Error('Failed to change plan')
    
    showSuccess('Subscription plan updated successfully')
    await fetchSubscription()
  } catch (error) {
    showError('Failed to change plan')
    console.error('Error changing plan:', error)
  }
}

// Lifecycle
onMounted(async () => {
  await fetchSubscription()
  await fetchSavedCards()
})
</script>
```
```

### 4. Write Protection Component
Component to wrap write operations:

```vue
<template>
  <div v-if="canWrite">
    <slot />
  </div>
  <div v-else>
    <slot name="fallback" v-if="$slots.fallback" />
    <div v-else class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
      <div class="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
        <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      
      <h3 class="text-lg font-semibold text-yellow-800 mb-2">
        {{ restrictionTitle }}
      </h3>
      
      <p class="text-yellow-700 mb-4">
        {{ restrictionMessage }}
      </p>
      
      <button
        @click="$router.push('/subscription')"
        class="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
      >
        Manage Subscription
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSubscriptionAccess } from '@/composables/useSubscriptionAccess'

const { canWrite, subscriptionStatus } = useSubscriptionAccess()

const restrictionTitle = computed(() => {
  switch (subscriptionStatus.value) {
    case 'SUSPENDED':
      return 'Subscription Suspended'
    case 'CANCELLED':
      return 'Subscription Cancelled'
    case 'PAYMENT_FAILED':
      return 'Payment Issue'
    default:
      return 'Subscription Required'
  }
})

const restrictionMessage = computed(() => {
  switch (subscriptionStatus.value) {
    case 'SUSPENDED':
      return 'Your subscription is suspended. Please update your payment method to restore access.'
    case 'CANCELLED':
      return 'Your subscription has been cancelled. Reactivate to continue using all features.'
    case 'PAYMENT_FAILED':
      return 'Your payment method needs attention. Update it to avoid service interruption.'
    default:
      return 'Active subscription required for this feature.'
  }
})
</script>
```

**Usage Example**:
```vue
<template>
  <!-- Protect entire sections -->
  <WriteProtectedComponent>
    <ProductEditor :product="product" @save="saveProduct" />
  </WriteProtectedComponent>

  <!-- With custom fallback -->
  <WriteProtectedComponent>
    <OrderManagement />
    
    <template #fallback>
      <div class="custom-restriction-message">
        <h4>Premium Feature</h4>
        <p>Upgrade your plan to access order management</p>
      </div>
    </template>
  </WriteProtectedComponent>

  <!-- Protect individual buttons -->
  <div class="button-group">
    <button class="btn btn-secondary">View Report</button>
    <WriteProtectedComponent>
      <button class="btn btn-primary" @click="createReport">Create Report</button>
    </WriteProtectedComponent>
  </div>
</template>
```
```

### 5. Admin Dashboard (System Admin Only)
For system administrators to monitor billing:

```vue
<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Billing Management</h1>
      <p class="text-gray-600">Monitor and manage subscription billing for all bakeries</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Due for Billing</p>
            <p class="text-2xl font-bold text-gray-900">{{ dueSubscriptions.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active Subscriptions</p>
            <p class="text-2xl font-bold text-gray-900">{{ activeCount }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="p-2 bg-orange-100 rounded-lg">
            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Payment Failed</p>
            <p class="text-2xl font-bold text-gray-900">{{ failedCount }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="p-2 bg-red-100 rounded-lg">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Suspended</p>
            <p class="text-2xl font-bold text-gray-900">{{ suspendedCount }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Billing Actions</h2>
        <div class="text-sm text-gray-500">
          Last processed: {{ lastProcessed || 'Never' }}
        </div>
      </div>
      
      <div class="flex gap-4">
        <button
          @click="processBilling"
          :disabled="processing || dueSubscriptions.length === 0"
          class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="processing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ processing ? 'Processing...' : `Process Billing (${dueSubscriptions.length})` }}
        </button>
        
        <button
          @click="refreshData"
          :disabled="loading"
          class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          Refresh Data
        </button>
      </div>
    </div>

    <!-- Due Subscriptions Table -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Subscriptions Due for Billing</h2>
      </div>
      
      <div v-if="loading" class="p-6 text-center">
        <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-gray-600">Loading subscriptions...</p>
      </div>
      
      <div v-else-if="dueSubscriptions.length === 0" class="p-6 text-center">
        <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
        <p class="text-gray-600">No subscriptions are currently due for billing.</p>
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bakery ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Billing
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Failures
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="subscription in dueSubscriptions" :key="subscription.bakeryId">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ subscription.bakeryId }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusBadgeClass(subscription.status)" 
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ subscription.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ subscription.tier }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatDate(subscription.nextBillingDate) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span :class="subscription.consecutiveFailures > 0 ? 'text-red-600 font-semibold' : ''">
                  {{ subscription.consecutiveFailures || 0 }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button
                  @click="retryBilling(subscription)"
                  class="text-blue-600 hover:text-blue-900"
                >
                  Retry
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Results -->
    <div v-if="lastResults" class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Last Billing Results</h2>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ lastResults.processed }}</div>
          <div class="text-sm text-gray-600">Processed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ lastResults.successful }}</div>
          <div class="text-sm text-gray-600">Successful</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-600">{{ lastResults.failed }}</div>
          <div class="text-sm text-gray-600">Failed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600">{{ lastResults.suspended }}</div>
          <div class="text-sm text-gray-600">Suspended</div>
        </div>
      </div>
      
      <div v-if="lastResults.errors?.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 class="text-sm font-medium text-red-800 mb-2">Errors:</h3>
        <ul class="text-sm text-red-700 space-y-1">
          <li v-for="error in lastResults.errors" :key="error.bakeryId">
            <strong>{{ error.bakeryId }}:</strong> {{ error.error }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFirebaseAuth } from '@/composables/useFirebaseAuth'
import { useNotifications } from '@/composables/useNotifications'

const { user } = useFirebaseAuth()
const { showSuccess, showError } = useNotifications()

// State
const dueSubscriptions = ref([])
const loading = ref(true)
const processing = ref(false)
const lastResults = ref(null)
const lastProcessed = ref(null)

// Computed
const activeCount = computed(() => 
  dueSubscriptions.value.filter(s => s.status === 'ACTIVE').length
)

const failedCount = computed(() => 
  dueSubscriptions.value.filter(s => s.status === 'PAYMENT_FAILED').length
)

const suspendedCount = computed(() => 
  dueSubscriptions.value.filter(s => s.status === 'SUSPENDED').length
)

// Methods
const fetchDueSubscriptions = async () => {
  try {
    loading.value = true
    const token = await user.value.getIdToken()
    const response = await fetch('/admin/billing/due', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) throw new Error('Failed to fetch subscriptions')
    
    const data = await response.json()
    dueSubscriptions.value = data.subscriptions
  } catch (error) {
    showError('Failed to load subscriptions')
    console.error('Error fetching subscriptions:', error)
  } finally {
    loading.value = false
  }
}

const processBilling = async () => {
  if (!confirm('Are you sure you want to process billing for all due subscriptions?')) {
    return
  }
  
  try {
    processing.value = true
    const token = await user.value.getIdToken()
    const response = await fetch('/admin/billing/process', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) throw new Error('Failed to process billing')
    
    const data = await response.json()
    lastResults.value = data.results
    lastProcessed.value = new Date().toLocaleString()
    
    showSuccess(`Billing processed: ${data.results.successful} successful, ${data.results.failed} failed`)
    
    // Refresh the list
    await fetchDueSubscriptions()
  } catch (error) {
    showError('Failed to process billing')
    console.error('Error processing billing:', error)
  } finally {
    processing.value = false
  }
}

const retryBilling = async (subscription) => {
  try {
    const token = await user.value.getIdToken()
    const response = await fetch(`/admin/billing/retry/${subscription.bakeryId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recurringPaymentId: subscription.recurringPaymentId
      })
    })
    
    if (!response.ok) throw new Error('Failed to retry billing')
    
    const data = await response.json()
    showSuccess(`Billing retry ${data.result.success ? 'successful' : 'failed'} for ${subscription.bakeryId}`)
    
    // Refresh the list
    await fetchDueSubscriptions()
  } catch (error) {
    showError('Failed to retry billing')
    console.error('Error retrying billing:', error)
  }
}

const refreshData = async () => {
  await fetchDueSubscriptions()
}

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'TRIAL': return 'bg-blue-100 text-blue-800'
    case 'ACTIVE': return 'bg-green-100 text-green-800'
    case 'PAYMENT_FAILED': return 'bg-orange-100 text-orange-800'
    case 'SUSPENDED': return 'bg-red-100 text-red-800'
    case 'CANCELLED': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  fetchDueSubscriptions()
})
</script>
```
```

## Error Handling

### Common Error Responses
```javascript
// Authentication Error
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_REQUIRED"
}

// Subscription Error
{
  "error": "Active subscription required for this operation",
  "subscriptionStatus": "SUSPENDED",
  "subscriptionTier": "BASIC",
  "code": "SUBSCRIPTION_REQUIRED"
}

// Validation Error
{
  "error": "recurringPaymentId is required"
}
```

### Error Handling Pattern
```javascript
const handleSubscriptionError = (error, response) => {
  if (response.status === 403 && response.data?.code === 'SUBSCRIPTION_REQUIRED') {
    // Redirect to subscription management
    navigate('/subscription');
    showToast('Subscription required', 'warning');
  } else if (response.status === 401) {
    // Handle authentication error
    signOut();
  } else {
    // Generic error handling
    showToast(error.message, 'error');
  }
};
```

## Response Headers
The backend includes subscription information in response headers:
```
X-Subscription-Status: ACTIVE
X-Subscription-Tier: BASIC
```

You can use these for additional UI state management or caching.

## State Management Recommendations

### 1. Subscription Context
```javascript
const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const { user } = useAuth();
  
  const refreshSubscription = async () => {
    if (user?.token?.claims?.bakeryId) {
      const response = await fetchSubscription(user.token.claims.bakeryId);
      setSubscription(response.subscription);
    }
  };
  
  return (
    <SubscriptionContext.Provider value={{
      subscription,
      refreshSubscription,
      canWrite: useSubscriptionAccess().canWrite
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
```

### 2. Token Refresh Handling
```javascript
// Listen for token refresh events
useEffect(() => {
  const unsubscribe = auth.onIdTokenChanged(async (user) => {
    if (user) {
      // Token refreshed, update subscription state
      const token = await user.getIdToken();
      const claims = await user.getIdTokenResult();
      updateSubscriptionFromClaims(claims.claims);
    }
  });
  
  return unsubscribe;
}, []);
```

## Development Tips

1. **Test with Emulators**: Use Firebase emulators for development
2. **Mock Subscription States**: Create mock data for different subscription statuses
3. **Error Boundary**: Wrap subscription components with error boundaries
4. **Loading States**: Handle loading states for async operations
5. **Optimistic Updates**: Update UI immediately, rollback on error
6. **Caching**: Cache subscription data but refresh on critical operations

## UI/UX Considerations

1. **Clear Status Communication**: Make subscription status immediately visible
2. **Graceful Degradation**: Provide read-only experience for suspended users
3. **Payment Flow**: Guide users through card setup and payment processes
4. **Trial Experience**: Highlight trial benefits and upcoming billing
5. **Error Recovery**: Provide clear paths to resolve payment issues
6. **Admin Experience**: Separate admin controls from regular user interface

## Testing Scenarios

Test these subscription scenarios in your frontend:

1. **Trial Period**: New bakery in trial
2. **Active Subscription**: Paid subscription with full access
3. **Payment Failed**: Failed payment with grace period
4. **Suspended**: Suspended subscription (read-only)
5. **Cancelled**: Cancelled subscription
6. **Card Updates**: Updating payment methods
7. **Plan Changes**: Upgrading/downgrading tiers
8. **Admin Operations**: System admin billing operations

## Security Notes

1. **Never store sensitive data**: All payment data handled by PayU
2. **Validate permissions**: Always check JWT claims for access control
3. **Handle token refresh**: Implement proper token refresh handling
4. **Sanitize inputs**: Validate all user inputs before API calls
5. **Error messages**: Don't expose sensitive information in error messages

This guide provides the foundation for implementing a complete subscription management interface. The backend handles all business logic, so focus on creating an intuitive user experience that clearly communicates subscription status and provides appropriate actions for each state.