import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";

const navy = "#002e66";
const gold = "#ffb81c";
const muted = "#555555";
const canvas = "#f4f4f4";
const wash = "#f7f4ea";

interface WelcomeEmailProps {
  firstName?: string;
  dashboardUrl?: string;
  verificationUrl?: string;
}

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        navy,
        gold,
        muted,
        canvas,
        wash,
      },
    },
  },
};

export const WelcomeEmail = ({
  firstName = "Aggie",
  dashboardUrl = "http://localhost:3000/dashboard",
  verificationUrl = "http://localhost:3000/api/auth/verify-email?token=preview&callbackURL=/dashboard",
}: WelcomeEmailProps) => {
  const previewText = `Confirm your email, ${firstName}. Then three things to do next.`;

  return (
    <Tailwind config={tailwindConfig}>
      <Html>
        <Head>
          <Font
            fontFamily="Montserrat"
            fallbackFontFamily="Arial"
            webFont={{
              url: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aX8.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="Montserrat"
            fallbackFontFamily="Arial"
            webFont={{
              url: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aX8.woff2",
              format: "woff2",
            }}
            fontWeight={700}
            fontStyle="normal"
          />
        </Head>
        <Body className="m-0 bg-canvas p-0 font-sans">
          <Preview>{previewText}</Preview>
          <Container className="mx-auto max-w-[560px] bg-white">
            <Section className="px-7 pt-8 pb-2">
              <Text className="m-0 text-[13px] font-bold tracking-[0.14em] text-navy uppercase">
                AggieTrack
              </Text>
              <Text className="mt-1 mb-0 text-[12px] text-muted">
                For CST students at North Carolina A&T
              </Text>
            </Section>

            <Section className="bg-wash px-7 py-10">
              <Text className="m-0 text-[14px] text-navy">
                Hey {firstName} —
              </Text>
              <Heading className="mt-3 mb-0 text-[32px] font-bold leading-[38px] tracking-[-0.03em] text-navy">
                You&apos;re in. Confirm it.
              </Heading>
              <Text className="mt-4 mb-0 text-[16px] leading-[26px] text-navy">
                This email is yours. Hit confirm, then three things to do next.
                The link expires in an hour.
              </Text>
              <Section className="mt-7">
                <Button
                  href={verificationUrl}
                  className="rounded-full bg-gold px-6 py-3 text-center text-[14px] font-bold text-navy no-underline"
                >
                  Confirm your email
                </Button>
              </Section>
            </Section>

            <Section className="px-7 pt-8 pb-2">
              <Text className="m-0 text-[13px] font-bold text-navy">
                After you confirm. Skip everything else for now.
              </Text>
            </Section>

            <Section className="px-7 pt-4 pb-2">
              <Row>
                <Column className="w-[48px] align-top">
                  <Text className="m-0 text-[22px] font-bold leading-[28px] text-gold">
                    01
                  </Text>
                </Column>
                <Column className="align-top">
                  <Text className="m-0 text-[16px] font-bold text-navy">
                    Put in what you&apos;ve already taken
                  </Text>
                  <Text className="mt-1 mb-2 text-[14px] leading-[22px] text-muted">
                    NCAT. Transfer. AP. Term and grade. Until this is in, the
                    rest is a guess.
                  </Text>
                  <Link
                    href={`${dashboardUrl}/courses`}
                    className="text-[14px] font-bold text-navy underline"
                  >
                    Add your courses →
                  </Link>
                </Column>
              </Row>
            </Section>

            <Section className="px-7 pt-6 pb-2">
              <Row>
                <Column className="w-[48px] align-top">
                  <Text className="m-0 text-[22px] font-bold leading-[28px] text-gold">
                    02
                  </Text>
                </Column>
                <Column className="align-top">
                  <Text className="m-0 text-[16px] font-bold text-navy">
                    See the honest count
                  </Text>
                  <Text className="mt-1 mb-2 text-[14px] leading-[22px] text-muted">
                    Credits toward 120. GPA. And the C-or-better rule on major
                    courses — so a passing D never looks like a finish.
                  </Text>
                  <Link
                    href={`${dashboardUrl}/progress`}
                    className="text-[14px] font-bold text-navy underline"
                  >
                    Check your progress →
                  </Link>
                </Column>
              </Row>
            </Section>

            <Section className="px-7 pt-6 pb-10">
              <Row>
                <Column className="w-[48px] align-top">
                  <Text className="m-0 text-[22px] font-bold leading-[28px] text-gold">
                    03
                  </Text>
                </Column>
                <Column className="align-top">
                  <Text className="m-0 text-[16px] font-bold text-navy">
                    Sketch the terms ahead
                  </Text>
                  <Text className="mt-1 mb-2 text-[14px] leading-[22px] text-muted">
                    Steal the eight-semester guide, then make it yours. Fall,
                    Spring, Summer. A plan is not a grade yet.
                  </Text>
                  <Link
                    href={`${dashboardUrl}/planner`}
                    className="text-[14px] font-bold text-navy underline"
                  >
                    Open the planner →
                  </Link>
                </Column>
              </Row>
            </Section>

            <Section className="bg-navy px-7 py-8">
              <Text className="m-0 text-[14px] leading-[22px] text-white">
                This is an AggieTrack audit against your catalog year — not the
                Registrar&apos;s. We say so up front.
              </Text>
              <Text className="mb-0 mt-4 text-[12px] leading-[18px] text-gold">
                You got this because you signed up. If it wasn&apos;t you, ignore
                it.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

WelcomeEmail.PreviewProps = {
  firstName: "James",
  dashboardUrl: "http://localhost:3000/dashboard",
  verificationUrl:
    "http://localhost:3000/api/auth/verify-email?token=preview&callbackURL=/dashboard",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
