import { Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const useCases = [
  {
    icon: Circle,
    title: "Automation with Flow",
    description:
      "Anyone can easily control the space using a visual editing tool.",
    image: "/images/flow.png",
  },
  {
    icon: Circle,
    title: "Space Control",
    description:
      "Control your surroundings and protect your assets through an intuitive, at-a-glance map interface.",
    image: "/images/map.png",
  },
  {
    icon: Circle,
    title: "Threat Detection (Coming Soon)",
    description:
      "Detect threats like burglars and porch pirates, and you can sound an alarm or respond automatically through Flow.",
  },
  {
    icon: Circle,
    title: "Local Mode (Coming Soon)",
    description:
      "Install the Vessel server on your laptop to use it on the go or in different network environments.",
  },
];

function UsecasePage() {
  return (
    <>
      <Navbar />
      <main className='container mx-auto max-w-5xl px-4 py-12 md:py-16'>
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-extrabold tracking-tight lg:text-5xl pt-16'>
            Use Cases
          </h1>
          <p className='mt-4 text-lg text-muted-foreground'>
            See how our product can be utilized in various scenarios.
          </p>
        </div>

        <div className='grid grid-cols-1 gap-8 md:grid-cols-2'>
          {useCases.map((useCase, index) => (
            <Card
              key={index}
              className='flex flex-col overflow-hidden transition-transform transform hover:-translate-y-1'
            >
              <CardHeader>
                <div className='flex items-center gap-4'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
                    <useCase.icon className='h-6 w-6 text-primary' />
                  </div>
                  <CardTitle className='text-lg'>{useCase.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className='flex flex-col flex-grow'>
                {useCase.image && (
                  <div className='w-full h-48 mb-4 rounded-md overflow-hidden'>
                    <img
                      src={useCase.image}
                      alt={`${useCase.title} image`}
                      className='w-full h-full object-cover'
                      loading='lazy'
                    />
                  </div>
                )}

                <p className='text-muted-foreground'>{useCase.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default UsecasePage;
