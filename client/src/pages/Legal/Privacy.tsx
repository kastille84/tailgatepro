import {
  LEGAL_ENTITY,
  LegalPage,
  LegalSection,
  SUPPORT_EMAIL,
} from "./LegalPage";

export const Privacy = () => (
  <LegalPage title="Privacy Policy">
    <p>
      TailgatePro (&quot;TailgatePro,&quot; &quot;we,&quot; &quot;us&quot;), operated
      by {LEGAL_ENTITY}, helps construction crews run and record OSHA-style safety talks and helps
      general contractors review that compliance. This policy explains what
      information we collect, how we use it, and the choices you have. It
      applies to our website and app at gettailgatepro.com (the
      &quot;Service&quot;). Our <a href="/terms">Terms &amp; Conditions</a>{" "}
      also apply.
    </p>

    <LegalSection heading="1. Information we collect">
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address,
          password (or Google sign-in identifier), role, and company name.
        </li>
        <li>
          <strong>Safety meeting records:</strong> the project and job site,
          topic, date and time, attendee names, attendee signatures, notes, and
          an optional crew photo you choose to take.
        </li>
        <li>
          <strong>Mobile phone number (optional):</strong> if you opt in to text
          reminders, or a general contractor enters your number for a job site,
          we store the number, the time consent was given, and whether you have
          confirmed or opted out.
        </li>
        <li>
          <strong>Billing information:</strong> payments are handled by our
          payment processor. We receive your plan and billing status, not your
          full card number.
        </li>
        <li>
          <strong>Usage and device data:</strong> basic technical information
          such as browser type and error logs, used to keep the Service working.
        </li>
        <li>
          <strong>Waitlist and contact information:</strong> your email if you
          join our waitlist or write to us.
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="2. How we use information">
      <ul>
        <li>To provide the Service, including storing and syncing your safety meeting records and generating compliance reports.</li>
        <li>To let general contractors see safety meetings logged by the subcontractors on their job sites.</li>
        <li>To send account, invitation, report, and billing emails.</li>
        <li>To send the weekly safety talk reminder text message you opted in to (see section 4).</li>
        <li>To process payments, prevent fraud and abuse, and secure the Service.</li>
        <li>To improve the Service and respond to support requests.</li>
      </ul>
    </LegalSection>

    <LegalSection heading="3. Who can see your information">
      <p>
        Safety meeting records are shared with the general contractor and
        company administrators connected to the project or job site, because
        that visibility is the purpose of the Service. We do not sell your
        personal information.
      </p>
      <p>
        We use service providers who process data on our behalf, only to run
        the Service: Supabase (database, authentication, and file storage),
        Stripe (payments), Mailgun (email delivery), Twilio (text messaging),
        and Anthropic (to help draft safety talk content; we do not send
        attendee personal information for this purpose). We may also disclose
        information if required by law or to protect rights and safety.
      </p>
    </LegalSection>

    <LegalSection heading="4. Text messages (SMS)">
      <p>
        If you opt in, we send a weekly safety talk reminder text, and in some
        cases a one-time message asking you to reply YES to confirm. Message
        frequency is about one message per week. Message and data rates may
        apply. Reply STOP at any time to opt out, or HELP for help.
      </p>
      <p>
        <strong>
          We do not sell, rent, or share mobile phone numbers or SMS opt-in
          data with third parties or affiliates for their marketing or
          promotional purposes.
        </strong>{" "}
        Mobile information is shared only with our messaging provider and
        carriers to deliver the messages you requested. See the SMS section of
        our <a href="/terms#sms">Terms &amp; Conditions</a>.
      </p>
    </LegalSection>

    <LegalSection heading="5. Data storage, offline use, and security">
      <p>
        The app can store meeting data on your device while you are offline and
        syncs it when you reconnect. We use industry-standard safeguards such
        as encrypted connections and access controls, but no system is
        completely secure.
      </p>
    </LegalSection>

    <LegalSection heading="6. Retention">
      <p>
        We keep safety meeting records and account data while your account is
        active, because compliance records are often needed for years. You can
        ask us to delete your account or your data at any time; we may retain
        information we are legally required to keep. If you opt out of texts, we
        keep your number on a suppression list so we do not text you again.
      </p>
    </LegalSection>

    <LegalSection heading="7. Your choices">
      <ul>
        <li>Turn text reminders off in Settings, or reply STOP to any text.</li>
        <li>Update your account details in Settings.</li>
        <li>
          Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to
          request access, correction, or deletion of your information.
        </li>
        <li>Unsubscribe from non-essential emails using the link in the email.</li>
      </ul>
    </LegalSection>

    <LegalSection heading="8. Children">
      <p>
        The Service is for working adults and is not directed to children under
        18. We do not knowingly collect information from children.
      </p>
    </LegalSection>

    <LegalSection heading="9. Changes to this policy">
      <p>
        We may update this policy. We will post the new version here and change
        the &quot;Last updated&quot; date above. Material changes will be
        communicated in the app or by email.
      </p>
    </LegalSection>

    <LegalSection heading="10. Contact us">
      <p>
        Questions about this policy? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalSection>
  </LegalPage>
);
