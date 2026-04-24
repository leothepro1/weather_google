// Thrown when a real Google Ads operation is attempted without a refresh
// token in D1 config. The HTTP layer maps this to 412 Precondition Failed.
export class NotConnectedError extends Error {
  constructor(message = 'Google Ads not connected') {
    super(message);
    this.name = 'NotConnectedError';
  }
}
