# Create Bakery Form - Frontend Implementation Guide

This document provides complete specifications for implementing the Create Bakery form that integrates with the backend API.

## Overview

The Create Bakery form allows new users to register their bakery business, creating both a user account and bakery profile in a single step. The backend handles user creation, bakery creation, and settings configuration atomically. The entire form should be implemented on a single page with different sections.

## API Integration

### Endpoint
```
POST /bakeries
```
- **Authentication**: None required (public endpoint)
- **Content-Type**: `application/json`

### Request Payload Structure

```javascript
const createBakeryRequest = {
  user: {
    name: "string",        // Required - Full name of the bakery admin
    email: "string",       // Required - Valid email address
    password: "string",    // Required - User password
    phone: "string"        // Optional - Phone number (auto-formatted by backend)
  },
  bakery: {
    name: "string",        // Required - Bakery business name
    address: "string",     // Optional - Physical address
    socialMedia: {         // Optional - Social media handles
      instagram: "string",
      facebook: "string",
      whatsapp: "string",
      website: "string"
    }
  },
  settings: {              // Optional - Advanced configuration
    features: {
      order: {
        activePaymentMethods: ["string"],    // Payment methods to enable
        allowPartialPayment: false,          // Allow partial payments
        defaultDate: "production",           // Default date type for orders
        timeOfDay: false                     // Ask for time of day in orders
      }
    }
  }
}
```

### Available Payment Methods

```javascript
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'davivienda', label: 'Davivienda' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'complimentary', label: 'Regalo' }
];
```

### Success Response

```javascript
const successResponse = {
  bakery: {
    id: "string",
    name: "string",
    address: "string",
    ownerId: "string",
    createdAt: "string",
    updatedAt: "string"
    // ... other bakery fields
  },
  settings: {
    id: "string",
    bakeryId: "string",
    features: {}
    // ... complete settings object with defaults
  },
  user: {
    uid: "string",
    email: "string",
    name: "string",
    role: "bakery_admin",
    bakeryId: "string"
  }
}
```

### Error Response

```javascript
const errorResponse = {
  error: "string"  // Human-readable error message
}
```

## Form Implementation Requirements

### Form Structure
Implement as a single-page form with the following sections organized vertically:

#### Section 1: User Information
- **Name** (required)
  - Text input
  - Validation: Non-empty string
- **Email** (required)
  - Email input
  - Validation: Valid email format
- **Password** (required)
  - Password input
  - Consider password strength indicator
- **Phone** (optional)
  - Text/tel input
  - Backend auto-formats the number

#### Section 2: Bakery Information
- **Bakery Name** (required)
  - Text input
  - Validation: Non-empty string
- **Address** (optional)
  - Text area or text input
- **Social Media** (optional, collapsible section)
  - Instagram handle
  - Facebook page
  - WhatsApp number
  - Website URL

#### Section 3: Features Configuration (Optional)
Add a toggle/checkbox: "Configure advanced features"

When enabled, show:
- **Active Payment Methods**
  - Checkbox group with available payment methods
  - Default: ['cash', 'transfer', 'complimentary']
- **Allow Partial Payments**
  - Toggle/checkbox
  - Default: false
- **Default Date Type**
  - Radio buttons: Production Date / Delivery Date
  - Default: production
- **Time of Day**
  - Toggle/checkbox: "Ask for specific time in orders"
  - Default: false

### Example Implementation

```javascript
// Example single-page form submission
const handleSubmit = async (event) => {
  event.preventDefault();
  
  // Get form data from form inputs
  const formData = new FormData(event.target);
  
  // Build payload object
  const payload = {
    user: {
      name: formData.get('userName'),
      email: formData.get('userEmail'),
      password: formData.get('userPassword')
    },
    bakery: {
      name: formData.get('bakeryName')
    }
  };
  
  // Add optional user fields
  if (formData.get('userPhone')) {
    payload.user.phone = formData.get('userPhone');
  }
  
  // Add optional bakery fields
  if (formData.get('bakeryAddress')) {
    payload.bakery.address = formData.get('bakeryAddress');
  }
  
  // Add social media if any provided
  const socialMedia = {};
  if (formData.get('instagram')) socialMedia.instagram = formData.get('instagram');
  if (formData.get('facebook')) socialMedia.facebook = formData.get('facebook');
  if (formData.get('whatsapp')) socialMedia.whatsapp = formData.get('whatsapp');
  if (formData.get('website')) socialMedia.website = formData.get('website');
  
  if (Object.keys(socialMedia).length > 0) {
    payload.bakery.socialMedia = socialMedia;
  }
  
  // Add features configuration if enabled
  if (formData.get('configureFeatures') === 'on') {
    const paymentMethods = formData.getAll('paymentMethods');
    
    payload.settings = {
      features: {
        order: {
          activePaymentMethods: paymentMethods.length > 0 ? paymentMethods : ['cash', 'transfer', 'complimentary'],
          allowPartialPayment: formData.get('allowPartialPayment') === 'on',
          defaultDate: formData.get('defaultDate') || 'production',
          timeOfDay: formData.get('timeOfDay') === 'on'
        }
      }
    };
  }

  try {
    const response = await fetch('/bakeries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    
    // Success - redirect to dashboard or show success message
    console.log('Bakery created successfully:', result);
    window.location.href = '/dashboard'; // or handle success as needed
    
  } catch (error) {
    // Handle validation errors - show error message to user
    console.error('Failed to create bakery:', error.message);
    document.getElementById('error-message').textContent = error.message;
  }
};
```

## Validation Rules

### Client-Side Validation
- **Email**: Must match email regex pattern
- **Required Fields**: Name, email, password, bakery name must be non-empty
- **Payment Methods**: If configuring features, at least one payment method should be selected

### Server-Side Validation
The backend will validate and return specific error messages for:
- Invalid email format
- Missing required fields
- Duplicate email addresses
- Invalid operating hours format (if implemented later)

## Error Handling

Display validation errors inline with form fields. Common errors include:
- "Invalid email format"
- "User email is required"
- "User password is required"
- "User name is required"
- "Bakery name is required"
- "A user with this email already exists"

## Security Considerations

- Password field should have `type="password"`
- Consider implementing client-side password strength validation
- The endpoint is public but backend validates all data
- No authentication token needed for this endpoint

## Success Flow

After successful bakery creation:
1. Store the returned user data (especially `uid` and `bakeryId`)
2. Redirect to bakery dashboard or onboarding flow
3. Consider sending a welcome email (if email service is configured)

## Testing

### Test Data Example
```javascript
const testData = {
  user: {
    name: "Test User",
    email: "test@example.com",
    password: "testPassword123",
    phone: "1234567890"
  },
  bakery: {
    name: "Test Bakery",
    address: "123 Test Street",
    socialMedia: {
      instagram: "@testbakery"
    }
  },
  settings: {
    features: {
      order: {
        activePaymentMethods: ['cash', 'transfer'],
        allowPartialPayment: true,
        defaultDate: 'production',
        timeOfDay: false
      }
    }
  }
};
```

## UI/UX Recommendations

1. **Section Dividers**: Use clear visual separation between User, Bakery, and Features sections
2. **Form Persistence**: Save form data locally to prevent loss on refresh
3. **Loading States**: Show loading spinner during submission and disable submit button
4. **Success Animation**: Celebrate successful bakery creation
5. **Feature Toggle**: Make advanced features clearly optional and collapsible
6. **Help Text**: Provide tooltips or help text for advanced features
7. **Responsive Design**: Ensure form works well on mobile devices
8. **Error Display**: Show validation errors inline with form fields
9. **Required Field Indicators**: Use asterisks (*) or other visual cues for required fields
10. **Section Headers**: Use clear headings like "Your Information", "Bakery Details", "Advanced Settings"

## Example HTML Structure

```html
<form onsubmit="handleSubmit(event)">
  <!-- Section 1: User Information -->
  <section class="form-section">
    <h2>Your Information</h2>
    <input type="text" name="userName" placeholder="Full Name" required>
    <input type="email" name="userEmail" placeholder="Email" required>
    <input type="password" name="userPassword" placeholder="Password" required>
    <input type="tel" name="userPhone" placeholder="Phone (optional)">
  </section>

  <!-- Section 2: Bakery Information -->
  <section class="form-section">
    <h2>Bakery Details</h2>
    <input type="text" name="bakeryName" placeholder="Bakery Name" required>
    <textarea name="bakeryAddress" placeholder="Address (optional)"></textarea>
    
    <!-- Collapsible Social Media Section -->
    <details>
      <summary>Social Media (optional)</summary>
      <input type="text" name="instagram" placeholder="Instagram handle">
      <input type="text" name="facebook" placeholder="Facebook page">
      <input type="text" name="whatsapp" placeholder="WhatsApp number">
      <input type="url" name="website" placeholder="Website URL">
    </details>
  </section>

  <!-- Section 3: Advanced Features -->
  <section class="form-section">
    <h2>Advanced Settings</h2>
    <label>
      <input type="checkbox" name="configureFeatures">
      Configure advanced features
    </label>
    
    <div id="features-section" style="display: none;">
      <!-- Payment methods checkboxes -->
      <!-- Other feature controls -->
    </div>
  </section>

  <div id="error-message" class="error"></div>
  <button type="submit">Create Bakery</button>
</form>
```

This implementation will create a complete bakery profile with user account, business information, and customized settings in a single, atomic operation on one page.