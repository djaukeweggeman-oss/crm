import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
const geist=Geist({variable:"--font-app",subsets:["latin"]});
export const metadata:Metadata={title:"NFC Administratie",description:"Eenvoudige bedrijfsadministratie voor NFC- en QR-producten",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nl"><body className={geist.variable}>{children}</body></html>}
