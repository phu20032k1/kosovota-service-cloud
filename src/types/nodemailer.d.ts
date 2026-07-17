declare module "nodemailer" {
  type SendMailOptions = {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  };
  type Transporter = {
    sendMail(options: SendMailOptions): Promise<{ messageId?: string; [key: string]: unknown }>;
  };
  function createTransport(options: unknown): Transporter;
  export default { createTransport };
}
