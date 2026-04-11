import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        <article className="container mx-auto max-w-4xl px-4 pt-24 pb-16 md:pt-28 md:pb-24">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl mb-8">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: April 11, 2026
          </p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Vessel's services, website, cloud
                platform, or any related software (collectively, the "Services"),
                you agree to be bound by these Terms of Service ("Terms"). If you
                do not agree to these Terms, you may not use the Services.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We may update these Terms from time to time. Continued use of the
                Services after any changes constitutes your acceptance of the
                revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Description of Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vessel is an open-source command-and-control (C2) platform for
                orchestrating and automating physical devices. The Services
                include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>
                  <strong>Open-Source Software:</strong> The Vessel dashboard and
                  core orchestration engine, available under the applicable
                  open-source license on GitHub.
                </li>
                <li>
                  <strong>Cloud Services:</strong> Managed remote tunnel access,
                  TURN/STUN relay services, Capsule API endpoints, account
                  management, and subscription billing.
                </li>
                <li>
                  <strong>Documentation:</strong> Technical documentation, guides,
                  and resources provided on our website.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Account Registration</h2>
              <p className="text-muted-foreground leading-relaxed">
                To access certain features of the Services, you must create an
                account. You agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>
                  Promptly update your information if it changes
                </li>
                <li>
                  Accept responsibility for all activities that occur under your
                  account
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We reserve the right to suspend or terminate accounts that violate
                these Terms or that we reasonably believe are being used for
                unauthorized purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to use the Services to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  Violate any applicable laws, regulations, or third-party rights
                </li>
                <li>
                  Interfere with or disrupt the integrity or performance of the
                  Services
                </li>
                <li>
                  Attempt to gain unauthorized access to any systems, networks,
                  or data
                </li>
                <li>
                  Distribute malware, viruses, or any other harmful software
                </li>
                <li>
                  Engage in any activity that could damage, disable, or impair
                  the Services
                </li>
                <li>
                  Use the Services for any illegal surveillance or unauthorized
                  monitoring activities
                </li>
                <li>
                  Resell, redistribute, or sublicense the cloud Services without
                  our prior written consent
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                5. Subscription and Payments
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Certain features of the Services require a paid subscription.
                By subscribing, you agree to the following:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>
                  <strong>Billing:</strong> Subscriptions are billed on a
                  recurring basis (monthly or annually) at the prices listed on
                  our pricing page at the time of purchase.
                </li>
                <li>
                  <strong>Payment Processing:</strong> Payments are processed by
                  our third-party payment provider (Polar). Your use of payment
                  services is subject to their terms.
                </li>
                <li>
                  <strong>Cancellation:</strong> You may cancel your subscription
                  at any time through your dashboard. Upon cancellation, you will
                  retain access until the end of your current billing period.
                </li>
                <li>
                  <strong>Refunds:</strong> Subscription fees are generally
                  non-refundable. Refunds may be granted at our sole discretion
                  on a case-by-case basis.
                </li>
                <li>
                  <strong>Price Changes:</strong> We reserve the right to change
                  our prices. We will provide advance notice of any price changes.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                6. Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The Vessel open-source software is licensed under the terms of
                its applicable open-source license, as specified in the project
                repository. All other aspects of the Services — including but
                not limited to the website design, branding, logos, cloud
                infrastructure, and proprietary APIs — are owned by Vessel and
                protected by intellectual property laws.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You retain ownership of any data or content you transmit through
                the Services. By using the Services, you grant us a limited
                license to process your data solely to provide and improve the
                Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                7. Open-Source Components
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Vessel's core software is open source. Your use of the
                open-source components is governed by the applicable open-source
                license. In the event of a conflict between these Terms and the
                open-source license, the open-source license will prevail with
                respect to the open-source components.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Self-hosted instances of Vessel operate independently, and these
                Terms apply only to the extent that you connect to or use our
                cloud Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                8. Service Availability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain high availability of our cloud Services but
                do not guarantee uninterrupted or error-free operation. We may
                suspend or discontinue any part of the Services at any time for
                maintenance, updates, or other reasons. We will make reasonable
                efforts to provide advance notice of planned downtime.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                9. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VESSEL AND ITS
                AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT
                BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE
                SERVICES, REGARDLESS OF THE CAUSE OF ACTION OR THE THEORY OF
                LIABILITY.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATED TO THE
                SERVICES SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE
                (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                10. Indemnification
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify, defend, and hold harmless Vessel and its
                affiliates from and against any claims, liabilities, damages,
                losses, and expenses (including reasonable attorneys' fees)
                arising out of or related to your use of the Services, your
                violation of these Terms, or your violation of any rights of a
                third party.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">11. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your access to the Services at any
                time, with or without cause, and with or without notice. Upon
                termination, your right to use the Services will immediately
                cease. Provisions of these Terms that by their nature should
                survive termination will survive, including but not limited to
                ownership provisions, warranty disclaimers, indemnity, and
                limitations of liability.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                12. Governing Law
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms are governed by and construed in accordance with the
                laws of the Republic of Korea, without regard to its conflict of
                law principles. Any disputes arising under these Terms shall be
                subject to the exclusive jurisdiction of the courts located in
                the Republic of Korea.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us
                at:
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:info@cartesiancs.com"
                  className="text-primary hover:underline"
                >
                  info@cartesiancs.com
                </a>
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2">
                <strong>GitHub:</strong>{" "}
                <a
                  href="https://github.com/cartesiancs/vessel"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/cartesiancs/vessel
                </a>
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
