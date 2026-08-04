import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"NFC Administratie",description:"Eenvoudige bedrijfsadministratie voor NFC- en QR-producten",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}
