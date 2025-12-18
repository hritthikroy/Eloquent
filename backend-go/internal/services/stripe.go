package services

import (
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"
	billingportalsession "github.com/stripe/stripe-go/v76/billingportal/session"
)

type StripeService struct {
	secretKey string
}

func NewStripeService(secretKey string) *StripeService {
	stripe.Key = secretKey
	return &StripeService{
		secretKey: secretKey,
	}
}

func (s *StripeService) CreateCheckoutSession(customerEmail, priceID, successURL, cancelURL string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{
		CustomerEmail: stripe.String(customerEmail),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		Mode:       stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
	}

	return session.New(params)
}

func (s *StripeService) CreatePortalSession(customerID, returnURL string) (*stripe.BillingPortalSession, error) {
	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(returnURL),
	}

	return billingportalsession.New(params)
}

func (s *StripeService) CreateCustomer(email, name string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(name),
	}

	return customer.New(params)
}

func (s *StripeService) GetCustomer(customerID string) (*stripe.Customer, error) {
	return customer.Get(customerID, nil)
}