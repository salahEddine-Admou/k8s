import React from "react";
import { useNavigate } from "react-router-dom"


export default function Card(props) {
    const navigate = useNavigate()
    const visitDetails = () => {
        navigate(`/experiencedetails/${props.id}`)
    }
  return (
    <div style={{ marginBottom: "2%", marginTop: "2%"}}>
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">{props.title}</h5>
          <h6 className="card-subtitle mb-2 text-body-secondary">{props.tripType}</h6>
          <p className="card-text">
            {props.description}
          </p>
          <button className="card-link btn btn-primary" onClick={visitDetails}>
            More Details
          </button>
        </div>
      </div>
    </div>
  );
}
