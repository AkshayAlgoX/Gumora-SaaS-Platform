interface ICashfreeConfig {
    app_id?: string;
    secret_key?: string;
    environment?: string;
}

interface CashfreeOrderRequest {
    order_amount: number;
    order_currency: string;
    order_id: string;
    customer_details: {
        customer_id: string;
        customer_name: string;
        customer_email: string;
        customer_phone: string;
    };
}

interface CashfreeOrderResponse {
    data: {
        order_id: string;
        order_token: string;
        order_status: string;
        payment_session_id: string;
    };
}

interface CashfreePaymentResponse {
    data: Array<{
        cf_payment_id: string;
        payment_status: string;
        payment_amount: number;
        payment_currency: string;
        payment_method: string;
    }>;
}

declare global {
    interface Window {
        Cashfree: {
            checkout: (options: CashfreeCheckoutOptions) => void;
        };
    }
}

interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: string;
    appearance?: {
        rebrandly?: boolean;
    };
}

declare class Cashfree {
    static XClientId: string;
    static XClientSecret: string;
    static XEnvironment: string;
    
    static PGCreateOrder(version: string, orderRequest: CashfreeOrderRequest): Promise<CashfreeOrderResponse>;
    static PGOrderFetchPayments(version: string, orderId: string): Promise<CashfreePaymentResponse>;
}

export = Cashfree