import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Preview,
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

interface ResetPasswordEmailProps {
  firstName?: string;
  resetUrl?: string;
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

export const ResetPasswordEmail = ({
  firstName = "Aggie",
  resetUrl = "http://localhost:3000/reset/password?token=preview",
}: ResetPasswordEmailProps) => {
  const previewText = `Reset your AggieTrack password, ${firstName}.`;

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
                Forgot it. Fine.
              </Heading>
              <Text className="mt-4 mb-0 text-[16px] leading-[26px] text-navy">
                Hit the button. Set a new password. The link expires in an hour.
                If you still know it, ignore this and log in.
              </Text>
              <Section className="mt-7">
                <Button
                  href={resetUrl}
                  className="rounded-full bg-gold px-6 py-3 text-center text-[14px] font-bold text-navy no-underline"
                >
                  Set a new password
                </Button>
              </Section>
            </Section>

            <Section className="bg-navy px-7 py-8">
              <Text className="m-0 text-[14px] leading-[22px] text-white">
                You got this because someone asked to reset the password on this
                email. If it wasn&apos;t you, ignore it.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

ResetPasswordEmail.PreviewProps = {
  firstName: "James",
  resetUrl: "http://localhost:3000/reset/password?token=preview",
} satisfies ResetPasswordEmailProps;

export default ResetPasswordEmail;
