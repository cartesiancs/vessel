import { Navbar } from "@/components/Navbar";
import { CheckCircle, Circle, Rocket } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Footer } from "@/components/Footer";

const roadmapData = [
  {
    status: "completed",
    title: "Phase 1: Prototype",
    description:
      "Defined core features and finalized the technology stack. Completed user experience (UX) design.",
    icon: <CheckCircle className='h-6 w-6 text-green-500' />,
  },
  {
    status: "in-progress",
    title: "Phase 2: Core Feature Development",
    description:
      "Developing key features, including video & audio hardware integration, MQTT connection, UDP, RTSP, real-time communication with WebRTC, a flow-based visual scripting tool, and map navigation, along with other minor functionalities.",
    icon: <Rocket className='h-6 w-6 text-blue-500 animate-pulse' />,
  },
  {
    status: "pending",
    title: "Phase 3: More Advanced Features",
    description:
      "Refining the product with more advanced features, including motion detection, enhanced security, LoRa communication, Agentic AI integration, map-based decision-making, audio analysis, and a comprehensive history feature.",
    icon: <Circle className='h-6 w-6 text-gray-400' />,
  },
  {
    status: "pending",
    title: "Phase 4: Minimum of C2 Software",
    description:
      "An integrated C2 (Command and Control) platform for spatial analysis, decision-making, threat detection, tracking, and third-party software integration.",
    icon: <Circle className='h-6 w-6 text-gray-400' />,
  },
  {
    status: "pending",
    title: "Phase 5: Launch of Watchtower",
    description:
      "Announcing a new, all-in-one hardware solution for instrumentation, security, and detection, featuring a full suite of integrated sensors including a 360° camera, audio, GPS, thermal imaging, and various environmental sensors.",
    icon: <Circle className='h-6 w-6 text-gray-400' />,
  },
  {
    status: "pending",
    title: "Phase 6: Launch of Self-Operating Drone",
    description: "Launching a drone that can contain multiple payloads.",
    icon: <Circle className='h-6 w-6 text-gray-400' />,
  },
];

function RoadmapPage() {
  return (
    <>
      <Navbar />
      <main className='container mx-auto max-w-3xl px-4 py-12 md:py-16'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-extrabold tracking-tight lg:text-5xl pt-16'>
            Project Roadmap
          </h1>
          <p className='mt-4 text-lg text-muted-foreground'>
            Follow our journey and see what's next on our agenda.
          </p>
        </div>

        <div className='relative'>
          <div className='absolute left-3 top-3 h-full w-0.5 bg-border -z-10'></div>

          <div className='space-y-10'>
            {roadmapData.map((item, index) => (
              <div key={index} className='flex items-start space-x-6'>
                <div className='flex-shrink-0 mt-1.5 bg-background rounded-full'>
                  {item.icon}
                </div>
                <Card
                  className={`w-full ${
                    item.status === "in-progress"
                      ? "border-blue-500 shadow-lg"
                      : ""
                  }`}
                >
                  <CardHeader>
                    <div className='flex justify-between items-center'>
                      <CardTitle>{item.title}</CardTitle>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          item.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : item.status === "in-progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {item.status === "completed"
                          ? "Completed"
                          : item.status === "in-progress"
                          ? "In Progress"
                          : "Planned"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{item.description}</CardDescription>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default RoadmapPage;
