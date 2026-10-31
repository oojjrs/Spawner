using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class RigBone {
    public int Parent;
    public double X, Y;
}
public class RigVertex {
    public double X, Y;
    public int[] Bones;
    public double[] Weights;
}
public class RigPart {
    public string TexturePath;
    public RigVertex[] Vertices;
    public int[] Triangles;
    public RigTexture CachedTexture;
}
public struct RigMatrix {
    public double A,B,C,D,X,Y;
    public RigMatrix(double a,double b,double c,double d,double x,double y) { A=a;B=b;C=c;D=d;X=x;Y=y; }
    public static RigMatrix Multiply(RigMatrix a,RigMatrix b) {
        return new RigMatrix(a.A*b.A+a.C*b.B,a.B*b.A+a.D*b.B,a.A*b.C+a.C*b.D,a.B*b.C+a.D*b.D,a.A*b.X+a.C*b.Y+a.X,a.B*b.X+a.D*b.Y+a.Y);
    }
    public RigMatrix Inverse() {
        double q=A*D-B*C;
        return new RigMatrix(D/q,-B/q,-C/q,A/q,(C*Y-D*X)/q,(B*X-A*Y)/q);
    }
}
public struct RigColor {
    public float R,G,B,A;
    public RigColor(float r,float g,float b,float a) { R=r;G=g;B=b;A=a; }
}
public class RigTexture {
    public int Width, Height;
    public float[] Pixels;
}
public class RigParticle {
    public double X,Y,Size,Opacity;
}
public static class RigSourceRenderer {
    const int Size=512;
    static RigTexture particleTexture;
    static RigTexture Read(string path) {
        using(Bitmap input=new Bitmap(path))
        using(Bitmap image=new Bitmap(input.Width,input.Height,PixelFormat.Format32bppArgb)) {
            int width=input.Width,height=input.Height;
            using(Graphics g=Graphics.FromImage(image)) {
                g.CompositingMode=System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                g.DrawImageUnscaled(input,0,0);
            }
            BitmapData data=image.LockBits(new Rectangle(0,0,width,height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
            byte[] bytes=new byte[data.Stride*height];
            Marshal.Copy(data.Scan0,bytes,0,bytes.Length);
            image.UnlockBits(data);
            float[] tex=new float[width*height*4];
            for(int y=0;y<height;y++) for(int x=0;x<width;x++) {
                int s=y*data.Stride+x*4,t=(y*width+x)*4;
                float a=bytes[s+3]/255f;
                tex[t]=bytes[s+2]/255f*a;
                tex[t+1]=bytes[s+1]/255f*a;
                tex[t+2]=bytes[s]/255f*a;
                tex[t+3]=a;
            }
            return new RigTexture { Width=width, Height=height, Pixels=tex };
        }
    }
    static RigColor Fetch(RigTexture tex,int x,int y) {
        if(x<0||y<0||x>=tex.Width||y>=tex.Height) return new RigColor(0,0,0,0);
        int i=(y*tex.Width+x)*4;
        return new RigColor(tex.Pixels[i],tex.Pixels[i+1],tex.Pixels[i+2],tex.Pixels[i+3]);
    }
    static RigColor Lerp(RigColor a,RigColor b,float t) {
        return new RigColor(a.R+(b.R-a.R)*t,a.G+(b.G-a.G)*t,a.B+(b.B-a.B)*t,a.A+(b.A-a.A)*t);
    }
    static RigColor Sample(RigTexture tex,double u,double v) {
        u*=tex.Width/(double)Size;
        v*=tex.Height/(double)Size;
        u-=0.5;v-=0.5;
        int x=(int)Math.Floor(u),y=(int)Math.Floor(v);
        float fx=(float)(u-x),fy=(float)(v-y);
        return Lerp(Lerp(Fetch(tex,x,y),Fetch(tex,x+1,y),fx),Lerp(Fetch(tex,x,y+1),Fetch(tex,x+1,y+1),fx),fy);
    }
    static void Skin(RigVertex v,RigMatrix[] matrices,out double x,out double y) {
        x=0;y=0;
        for(int k=0;k<v.Bones.Length;k++) {
            RigMatrix m=matrices[v.Bones[k]];
            x+=v.Weights[k]*(m.A*v.X+m.C*v.Y+m.X);
            y+=v.Weights[k]*(m.B*v.X+m.D*v.Y+m.Y);
        }
    }
    static void DrawPart(float[] result,RigPart part,RigMatrix[] matrices) {
        RigTexture tex=part.CachedTexture;
        if(tex==null) {
            tex=Read(part.TexturePath);
            part.CachedTexture=tex;
        }
        float[] layer=new float[Size*Size*4];
        double[] px=new double[part.Vertices.Length],py=new double[part.Vertices.Length];
        for(int i=0;i<px.Length;i++) Skin(part.Vertices[i],matrices,out px[i],out py[i]);
        for(int ti=0;ti<part.Triangles.Length;ti+=3) {
            int a=part.Triangles[ti],b=part.Triangles[ti+1],c=part.Triangles[ti+2];
            double ax=px[a],ay=py[a],bx=px[b],by=py[b],cx=px[c],cy=py[c];
            double den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
            if(Math.Abs(den)<0.000001) continue;
            int left=Math.Max(0,(int)Math.Floor(Math.Min(ax,Math.Min(bx,cx))));
            int right=Math.Min(Size-1,(int)Math.Ceiling(Math.Max(ax,Math.Max(bx,cx))));
            int top=Math.Max(0,(int)Math.Floor(Math.Min(ay,Math.Min(by,cy))));
            int bottom=Math.Min(Size-1,(int)Math.Ceiling(Math.Max(ay,Math.Max(by,cy))));
            RigVertex va=part.Vertices[a],vb=part.Vertices[b],vc=part.Vertices[c];
            for(int y=top;y<=bottom;y++) for(int x=left;x<=right;x++) {
                double sx=x+0.5,sy=y+0.5;
                double wa=((by-cy)*(sx-cx)+(cx-bx)*(sy-cy))/den;
                double wb=((cy-ay)*(sx-cx)+(ax-cx)*(sy-cy))/den;
                double wc=1-wa-wb;
                if(wa<-.0000001||wb<-.0000001||wc<-.0000001) continue;
                RigColor color=Sample(tex,wa*va.X+wb*vb.X+wc*vc.X,wa*va.Y+wb*vb.Y+wc*vc.Y);
                int k=(y*Size+x)*4;
                layer[k]=color.R;layer[k+1]=color.G;layer[k+2]=color.B;layer[k+3]=color.A;
            }
        }
        for(int i=0;i<result.Length;i+=4) {
            float inv=1-layer[i+3];
            result[i]=layer[i]+result[i]*inv;
            result[i+1]=layer[i+1]+result[i+1]*inv;
            result[i+2]=layer[i+2]+result[i+2]*inv;
            result[i+3]=layer[i+3]+result[i+3]*inv;
        }
    }
    static byte Byte(double x) { return (byte)Math.Max(0,Math.Min(255,(int)Math.Round(x*255))); }
    static void Save(float[] pixels,string path) {
        using(Bitmap image=new Bitmap(Size,Size,PixelFormat.Format32bppArgb)) {
            BitmapData data=image.LockBits(new Rectangle(0,0,Size,Size),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
            byte[] bytes=new byte[data.Stride*Size];
            for(int y=0;y<Size;y++) for(int x=0;x<Size;x++) {
                int s=(y*Size+x)*4,t=y*data.Stride+x*4;
                float a=pixels[s+3];
                if(a>0.000001) {
                    bytes[t]=Byte(pixels[s+2]/a);
                    bytes[t+1]=Byte(pixels[s+1]/a);
                    bytes[t+2]=Byte(pixels[s]/a);
                    bytes[t+3]=Byte(a);
                }
            }
            Marshal.Copy(bytes,0,data.Scan0,bytes.Length);
            image.UnlockBits(data);
            image.Save(path,ImageFormat.Png);
        }
    }
    static float[] DrawRig(RigPart[] parts,RigBone[] bones,double[] angles,double[] offsetsY) {
        RigMatrix[] bind=new RigMatrix[bones.Length],pose=new RigMatrix[bones.Length],skin=new RigMatrix[bones.Length];
        for(int i=0;i<bones.Length;i++) {
            RigBone b=bones[i];
            RigMatrix localBind=new RigMatrix(1,0,0,1,b.X,b.Y);
            double angle=angles[i]*Math.PI/180;
            RigMatrix localPose=new RigMatrix(Math.Cos(angle),Math.Sin(angle),-Math.Sin(angle),Math.Cos(angle),b.X,b.Y+offsetsY[i]);
            bind[i]=b.Parent<0?localBind:RigMatrix.Multiply(bind[b.Parent],localBind);
            pose[i]=b.Parent<0?localPose:RigMatrix.Multiply(pose[b.Parent],localPose);
            skin[i]=RigMatrix.Multiply(pose[i],bind[i].Inverse());
        }
        float[] result=new float[Size*Size*4];
        foreach(RigPart part in parts) DrawPart(result,part,skin);
        return result;
    }
    public static void Render(RigPart[] parts,RigBone[] bones,double[] angles,double[] offsetsY,string path) {
        Save(DrawRig(parts,bones,angles,offsetsY),path);
    }
    static float[] DrawAnimationFrame(RigPart[] parts,RigBone[] bones,double[] angles,double[] offsetsY,RigParticle[] particles,string particlePath) {
        float[] pixels=DrawRig(parts,bones,angles,offsetsY);
        if(particles.Length>0 && particleTexture==null) particleTexture=Read(particlePath);
        foreach(RigParticle p in particles) {
            double left=p.X-p.Size/2,top=p.Y-p.Size/2;
            int x0=Math.Max(0,(int)Math.Floor(left)),x1=Math.Min(Size-1,(int)Math.Ceiling(left+p.Size));
            int y0=Math.Max(0,(int)Math.Floor(top)),y1=Math.Min(Size-1,(int)Math.Ceiling(top+p.Size));
            for(int y=y0;y<=y1;y++) for(int x=x0;x<=x1;x++) {
                double u=(x+0.5-left)/p.Size*Size,v=(y+0.5-top)/p.Size*Size;
                RigColor color=Sample(particleTexture,u,v);
                float opacity=(float)p.Opacity,alpha=color.A*opacity;
                int i=(y*Size+x)*4;
                pixels[i]=color.R*opacity+pixels[i]*(1-alpha);
                pixels[i+1]=color.G*opacity+pixels[i+1]*(1-alpha);
                pixels[i+2]=color.B*opacity+pixels[i+2]*(1-alpha);
                pixels[i+3]=alpha+pixels[i+3]*(1-alpha);
            }
        }
        return pixels;
    }
    public static void RenderTransparentAnimationFrame(RigPart[] parts,RigBone[] bones,double[] angles,double[] offsetsY,RigParticle[] particles,string particlePath,string path) {
        Save(DrawAnimationFrame(parts,bones,angles,offsetsY,particles,particlePath),path);
    }
    public static void RenderAnimationFrame(RigPart[] parts,RigBone[] bones,double[] angles,double[] offsetsY,RigParticle[] particles,string particlePath,string path) {
        float[] pixels=DrawAnimationFrame(parts,bones,angles,offsetsY,particles,particlePath);
        for(int i=0;i<pixels.Length;i+=4) {
            float inv=1-pixels[i+3];
            pixels[i]+=228/255f*inv;
            pixels[i+1]+=224/255f*inv;
            pixels[i+2]+=214/255f*inv;
            pixels[i+3]=1;
        }
        Save(pixels,path);
    }
}
