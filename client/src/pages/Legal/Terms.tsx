import {
  LEGAL_ENTITY,
  LegalPage,
  LegalSection,
  SUPPORT_EMAIL,
} from "./LegalPage";

export const Terms = () => (
  <LegalPage title="Terms & Conditions">
    <p>
      These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of
      TailgatePro (&quot;TailgatePro,&quot; &quot;we,&quot; &quot;us&quot;), operated
      by {LEGAL_ENTITY}, our website and app at gettailgatepro.com (the &quot;Service&quot;). By
      creating an account or using the Service you agree to these Terms and to
      our <a href="/privacy">Privacy Policy</a>.
    </p>

    <LegalSection heading="1. The Service">
      <p>
        TailgatePro lets subcontractor foremen run and record safety talks
        (toolbox talks) on the job site, including offline, and lets general
        contractors review which meetings were held. You must be at least 18
        and have authority to use the Service for your company.
      </p>
    </LegalSection>

    <LegalSection heading="2. Your account">
      <p>
        Keep your login credentials secure and give us accurate information.
        You are responsible for activity under your account. Tell us promptly
        if you suspect unauthorized access.
      </p>
    </LegalSection>

    <LegalSection heading="3. Safety content is not legal advice">
      <p>
        Safety talk content, OSHA references, and compliance reports are
        provided for general informational and record-keeping purposes. They do
        not replace your own safety program, a qualified safety professional,
        or applicable law. You are responsible for meeting your OSHA and other
        legal obligations and for the accuracy of the records you enter.
      </p>
    </LegalSection>

    <LegalSection heading="4. Acceptable use">
      <ul>
        <li>Do not enter false attendance records or forge signatures.</li>
        <li>Do not misuse, disrupt, or attempt to gain unauthorized access to the Service.</li>
        <li>Do not upload unlawful content or content you have no right to share.</li>
        <li>Do not add a phone number to text reminders unless you have that person&apos;s permission.</li>
      </ul>
    </LegalSection>

    <LegalSection heading="5. Your content">
      <p>
        You own the meeting records, photos, and other content you submit. You
        give us a license to host, process, and display it to provide the
        Service, including showing it to the general contractor and company
        administrators connected to your project.
      </p>
    </LegalSection>

    <LegalSection heading="6. Plans and billing">
      <p>
        Paid plans are billed through our payment processor on a recurring
        basis until cancelled. Prices, plan limits, and features are shown on
        our Pricing page and may change with notice. You can cancel at any time;
        access continues through the end of the paid period unless stated
        otherwise.
      </p>
    </LegalSection>

    <div id="sms">
      <LegalSection heading="7. Text message (SMS) program terms">
        <ul>
          <li>
            <strong>Program:</strong> TailgatePro Safety Talk Reminders. We send
            a text reminder when your general contractor has no safety talk
            logged from your company for the previous week. In some cases we
            first send a one-time message asking you to reply YES to confirm.
          </li>
          <li>
            <strong>How you opt in:</strong> a foreman enters their own mobile
            number in Settings and checks the box agreeing to receive texts, or
            a general contractor enters a number for a job site, after which we
            send one message and texts start only if the recipient replies YES.
            Consent is not a condition of purchase or of using the Service.
          </li>
          <li>
            <strong>Frequency:</strong> about one message per week, sent
            Mondays at 7:00 AM job site local time, plus the one-time YES
            confirmation request.
          </li>
          <li>
            <strong>Cost:</strong> message and data rates may apply, depending
            on your mobile plan.
          </li>
          <li>
            <strong>Opt out:</strong> reply STOP at any time. You will get one
            confirmation and no further messages. You can also turn reminders
            off in Settings. To start again, reply START or save your number
            again in Settings.
          </li>
          <li>
            <strong>Help:</strong> reply HELP or email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </li>
          <li>
            <strong>Carriers:</strong> wireless carriers are not liable for
            delayed or undelivered messages.
          </li>
          <li>
            <strong>Privacy:</strong> we do not share mobile numbers or opt-in
            data with third parties for marketing. See our{" "}
            <a href="/privacy">Privacy Policy</a>.
          </li>
        </ul>
      </LegalSection>
    </div>

    <LegalSection heading="8. Availability and changes">
      <p>
        We work to keep the Service available but do not guarantee
        uninterrupted or error-free operation, and offline data syncs only when
        your device reconnects. We may change or discontinue features.
      </p>
    </LegalSection>

    <LegalSection heading="9. Termination">
      <p>
        You may stop using the Service at any time. We may suspend or end
        access for violations of these Terms or to protect the Service or other
        users.
      </p>
    </LegalSection>

    <LegalSection heading="10. Disclaimers and limitation of liability">
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind. To the fullest extent allowed by law,
        TailgatePro is not liable for indirect, incidental, or consequential
        damages, or for OSHA citations, fines, or workplace incidents, and our
        total liability for any claim is limited to the amount you paid us in
        the 12 months before the claim.
      </p>
    </LegalSection>

    <LegalSection heading="11. Changes to these Terms">
      <p>
        We may update these Terms. We will post the new version here and update
        the &quot;Last updated&quot; date. Continued use after a change means
        you accept it.
      </p>
    </LegalSection>

    <LegalSection heading="12. Contact us">
      <p>
        Questions? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalSection>
  </LegalPage>
);
