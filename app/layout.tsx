import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"WGMN Digital Administratie",description:"Eenvoudige bedrijfsadministratie van WGMN Digital",icons:{icon:"/favicon.svg"}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#125b4e"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}
