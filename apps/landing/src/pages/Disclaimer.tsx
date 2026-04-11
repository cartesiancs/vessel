import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function DisclaimerPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        <article className="container mx-auto max-w-4xl px-4 pt-24 pb-16 md:pt-28 md:pb-24">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl mb-8">
            Disclaimer
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: April 11, 2026
          </p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">
                1. General Disclaimer
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The information, software, and services provided by Vessel
                ("we," "our," or "us") are offered on an "as is" and "as
                available" basis without warranties of any kind, either express
                or implied. We do not warrant that the Services will be
                uninterrupted, error-free, or free of harmful components.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Your use of the Services is at your sole risk. We expressly
                disclaim all warranties, including but not limited to implied
                warranties of merchantability, fitness for a particular purpose,
                and non-infringement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                2. Open-Source Software
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Vessel's core dashboard and orchestration engine are open-source
                software. Open-source software is provided without any warranty,
                as stated in the applicable open-source license. You acknowledge
                that:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>
                  The software may contain bugs, errors, or vulnerabilities
                </li>
                <li>
                  You are responsible for evaluating the software's suitability
                  for your intended use
                </li>
                <li>
                  Self-hosted deployments are entirely your responsibility,
                  including security, maintenance, and compliance
                </li>
                <li>
                  Community contributions are not guaranteed to be reviewed,
                  tested, or free of defects
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                3. Device and Hardware Interactions
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Vessel is designed to orchestrate and automate physical devices.
                You acknowledge and agree that:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>
                  <strong>Physical Risk:</strong> Controlling physical devices
                  remotely involves inherent risks. Incorrect configurations,
                  software errors, or network failures could result in
                  unintended device behavior.
                </li>
                <li>
                  <strong>No Liability for Damage:</strong> We are not liable for
                  any damage to property, equipment, or persons resulting from
                  the use or misuse of Vessel in connection with physical
                  devices.
                </li>
                <li>
                  <strong>User Responsibility:</strong> You are solely
                  responsible for ensuring that your device configurations,
                  automation flows, and security settings are appropriate and
                  safe for your environment.
                </li>
                <li>
                  <strong>Compliance:</strong> You are responsible for complying
                  with all applicable laws and regulations governing the
                  operation of connected devices in your jurisdiction.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                4. Security Disclaimer
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                While we implement reasonable security measures for our cloud
                Services, no system is completely secure. We disclaim liability
                for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>
                  Unauthorized access to your account or devices resulting from
                  compromised credentials or third-party breaches
                </li>
                <li>
                  Security vulnerabilities in self-hosted deployments that are
                  not maintained or updated
                </li>
                <li>
                  Data loss or interception during transmission over public
                  networks
                </li>
                <li>
                  Security incidents arising from third-party integrations or
                  plugins
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You are responsible for implementing appropriate security
                practices, including keeping your software up to date, using
                strong authentication, and regularly reviewing access controls.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                5. Cloud Services
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our cloud Services, including remote tunnel access and
                TURN/STUN relay, are provided for convenience and may be
                subject to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>Scheduled or unscheduled downtime for maintenance</li>
                <li>
                  Capacity limitations or throttling during high-demand periods
                </li>
                <li>
                  Service modifications, suspensions, or discontinuations with
                  reasonable notice
                </li>
                <li>
                  Regional availability restrictions due to infrastructure or
                  legal requirements
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We do not guarantee any specific uptime percentage or service
                level unless explicitly stated in a separate service level
                agreement (SLA).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                6. Third-Party Services
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The Services may integrate with or rely on third-party services,
                including but not limited to Google OAuth, Supabase, and Polar.
                We are not responsible for the availability, accuracy, or
                reliability of any third-party services. Your use of third-party
                services is subject to their respective terms and policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                7. No Professional Advice
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Nothing in our Services, documentation, or communications
                constitutes professional, legal, security, or engineering advice.
                The information provided is for general informational purposes
                only. You should consult qualified professionals for advice
                specific to your situation, particularly regarding physical
                security systems and device automation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                8. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, VESSEL SHALL
                NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
                CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED
                TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, OR OTHER
                INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>Your use or inability to use the Services</li>
                <li>
                  Any unauthorized access to or alteration of your data or
                  devices
                </li>
                <li>
                  Any interruption, suspension, or termination of the Services
                </li>
                <li>
                  Any bugs, errors, or inaccuracies in the software or
                  documentation
                </li>
                <li>
                  Any damage to physical property or personal injury resulting
                  from the use of the Services with physical devices
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                9. Indemnification
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless Vessel, its affiliates,
                and their respective officers, directors, employees, and agents
                from any claims, damages, losses, liabilities, and expenses
                (including attorneys' fees) arising from your use of the
                Services, your violation of these terms, or your infringement of
                any third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">
                10. Changes to This Disclaimer
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to update or modify this Disclaimer at any
                time. Changes will be effective upon posting to our website. Your
                continued use of the Services after any changes constitutes
                acceptance of the updated Disclaimer.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">11. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions or concerns about this Disclaimer, please
                contact us at:
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
