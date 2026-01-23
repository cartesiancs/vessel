import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        <article className="container mx-auto max-w-4xl px-4 pt-24 pb-16 md:pt-28 md:pb-24">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl mb-8">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: January 23, 2026
          </p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vessel ("we," "our," or "us") is committed to protecting your
                privacy. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you use our
                services, including our cloud-based remote tunnel service and
                related offerings.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Our core dashboard and orchestration software is open source and
                available on GitHub. This Privacy Policy applies specifically to
                the cloud services we provide, including account management,
                remote tunnel access, and subscription billing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                2. Information We Collect
              </h2>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                2.1 Information You Provide
              </h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Account Information:</strong> When you create an
                  account, we collect your name, email address, and
                  authentication credentials through Google OAuth.
                </li>
                <li>
                  <strong>Payment Information:</strong> When you subscribe to
                  our paid services, payment processing is handled by our
                  third-party payment processor (Polar). We do not store your
                  full credit card numbers.
                </li>
                <li>
                  <strong>Support Communications:</strong> If you contact us for
                  support, we collect the information you provide in your
                  communications.
                </li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">
                2.2 Information Collected Automatically
              </h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Usage Data:</strong> We collect information about how
                  you interact with our services, including connection logs,
                  tunnel usage statistics, and feature usage.
                </li>
                <li>
                  <strong>Device Information:</strong> We may collect
                  information about the devices you use to access our services,
                  including device identifiers and connection metadata.
                </li>
                <li>
                  <strong>Log Data:</strong> Our servers automatically record
                  information including IP addresses, access times, and request
                  details for security and troubleshooting purposes.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                3. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage your subscription</li>
                <li>
                  Send you technical notices, updates, and support messages
                </li>
                <li>Respond to your comments, questions, and requests</li>
                <li>
                  Monitor and analyze trends, usage, and activities in
                  connection with our services
                </li>
                <li>
                  Detect, investigate, and prevent fraudulent transactions and
                  other illegal activities
                </li>
                <li>Protect the rights and safety of Vessel and our users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                4. Data Sharing and Disclosure
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We do not sell your personal information. We may share your
                information in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Service Providers:</strong> We share information with
                  third-party vendors who perform services on our behalf,
                  including payment processing (Polar), authentication
                  (Supabase), and cloud infrastructure providers.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> We may disclose
                  information if required by law, regulation, or legal process.
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with any
                  merger, sale of company assets, or acquisition, your
                  information may be transferred.
                </li>
                <li>
                  <strong>With Your Consent:</strong> We may share information
                  with your consent or at your direction.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                5. Open Source Software
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The Vessel dashboard and core orchestration software are open
                source projects maintained on GitHub. When you self-host Vessel,
                no data is transmitted to us unless you explicitly connect to
                our cloud services. The open source software operates entirely
                on your own infrastructure.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                This Privacy Policy applies only to data collected through our
                cloud services (such as Remote Tunnel, account management, and
                subscription services) and our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures
                to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction. These measures
                include encryption in transit and at rest, access controls, and
                regular security assessments.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                However, no method of transmission over the Internet or
                electronic storage is 100% secure. While we strive to protect
                your personal information, we cannot guarantee its absolute
                security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as your account
                is active or as needed to provide you services. We will retain
                and use your information as necessary to comply with our legal
                obligations, resolve disputes, and enforce our agreements.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You may request deletion of your account and associated data by
                contacting us. Upon deletion, we will remove your personal
                information from our active systems, though some information may
                be retained in backups for a limited period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">8. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Depending on your location, you may have certain rights
                regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Access:</strong> You can request a copy of your
                  personal information.
                </li>
                <li>
                  <strong>Correction:</strong> You can request that we correct
                  inaccurate information.
                </li>
                <li>
                  <strong>Deletion:</strong> You can request that we delete your
                  personal information.
                </li>
                <li>
                  <strong>Portability:</strong> You can request a copy of your
                  data in a portable format.
                </li>
                <li>
                  <strong>Opt-out:</strong> You can opt out of certain data
                  processing activities.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                To exercise these rights, please contact us at the email address
                provided below.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                9. California Privacy Rights
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you are a California resident, you have additional rights
                under the California Consumer Privacy Act (CCPA). These include
                the right to know what personal information we collect, the
                right to delete your personal information, and the right to
                opt-out of the sale of personal information. We do not sell
                personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                10. Children's Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our services are not directed to children under the age of 13.
                We do not knowingly collect personal information from children
                under 13. If we learn that we have collected personal
                information from a child under 13, we will take steps to delete
                such information promptly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                11. International Data Transfers
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in
                countries other than your country of residence. These countries
                may have data protection laws that are different from the laws
                of your country. We take appropriate safeguards to ensure that
                your personal information remains protected in accordance with
                this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                12. Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. If we make
                material changes, we will notify you by updating the date at the
                top of this policy and, in some cases, we may provide additional
                notice (such as adding a statement to our website or sending you
                a notification).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our
                privacy practices, please contact us at:
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
